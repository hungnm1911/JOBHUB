import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import COMPANY_MEMBER_ROLE from "../../src/constants/company-member-role.js";
import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import LOCATION from "../../src/constants/location.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import { migrate as migrateExperienceLevels } from "../../src/database/migrations/v4-experience-level-dataset.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import Job from "../../src/models/job.model.js";
import {
  createFieldCategory,
  createPositionCategory,
} from "../../src/services/category.service.js";
import {
  assertPrePublicationDeleteAuthority,
  buildInternalJobVisibilityFilter,
  isJobInternallyVisible,
} from "../../src/services/job.service.js";
import AppError from "../../src/utils/app-error.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  DEFAULT_PASSWORD,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

describe("V5 Slice 12 — DRAFT privacy + pre-publication delete authority (F03, F12)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  const seedCatalog = async () => {
    await migrateExperienceLevels();

    const field = await createFieldCategory({
      name: "Software Engineering",
    });
    const position = await createPositionCategory({
      name: "Backend Engineer",
      parentCategoryId: field.id,
    });
    const experienceLevel = await ExperienceLevel.findOne({
      code: EXPERIENCE_LEVEL.ONE_TO_THREE_YEARS,
    }).lean();

    return {
      field,
      position,
      experienceLevelId: experienceLevel._id.toString(),
    };
  };

  const buildCompleteContent = (catalog, overrides = {}) => {
    return {
      title: "Backend Engineer",
      jobDescription: "Build Job lifecycle APIs.",
      requiredSkills: ["Node.js", "MongoDB"],
      salaryText: "Negotiate",
      fieldCategoryIds: [catalog.field.id],
      positionCategoryIds: [catalog.position.id],
      location: LOCATION.HA_NOI,
      employmentType: EMPLOYMENT_TYPE.FULL_TIME,
      workModes: [WORK_MODE.HYBRID],
      experienceLevelId: catalog.experienceLevelId,
      applicationDeadline: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      ...overrides,
    };
  };

  const createJob = async ({
    companyId,
    createdByCompanyMemberId,
    primaryRecruiterCompanyMemberId = createdByCompanyMemberId,
    status,
    title,
  }) => {
    return Job.create({
      companyId,
      createdByCompanyMemberId,
      primaryRecruiterCompanyMemberId,
      status,
      title,
      publishedAt:
        status === JOB_STATUS.PUBLISHED ||
        status === JOB_STATUS.CLOSED ||
        status === JOB_STATUS.EXPIRED
          ? new Date("2026-01-15T00:00:00.000Z")
          : null,
    });
  };

  describe("shared visibility boundary correction (BR-36/BR-37/BR-43)", () => {
    it("keeps DRAFT private to current Primary and excludes DRAFT from CM filter", () => {
      const companyId = new mongoose.Types.ObjectId();
      const primaryId = new mongoose.Types.ObjectId();
      const peerId = new mongoose.Types.ObjectId();

      expect(
        buildInternalJobVisibilityFilter({
          companyId,
          companyRole: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
          membershipId: new mongoose.Types.ObjectId(),
        }),
      ).toEqual({
        companyId,
        status: {
          $in: [
            JOB_STATUS.PENDING_APPROVAL,
            JOB_STATUS.PUBLISHED,
            JOB_STATUS.CLOSED,
            JOB_STATUS.EXPIRED,
          ],
        },
      });

      expect(
        isJobInternallyVisible({
          job: {
            primaryRecruiterCompanyMemberId: primaryId,
            status: JOB_STATUS.DRAFT,
          },
          companyRole: COMPANY_MEMBER_ROLE.RECRUITER,
          membershipId: primaryId,
        }),
      ).toBe(true);

      expect(
        isJobInternallyVisible({
          job: {
            primaryRecruiterCompanyMemberId: primaryId,
            status: JOB_STATUS.DRAFT,
          },
          companyRole: COMPANY_MEMBER_ROLE.RECRUITER,
          membershipId: peerId,
        }),
      ).toBe(false);

      expect(
        isJobInternallyVisible({
          job: {
            primaryRecruiterCompanyMemberId: primaryId,
            status: JOB_STATUS.DRAFT,
          },
          companyRole: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
          membershipId: new mongoose.Types.ObjectId(),
        }),
      ).toBe(false);

      for (const status of [
        JOB_STATUS.PENDING_APPROVAL,
        JOB_STATUS.PUBLISHED,
        JOB_STATUS.CLOSED,
        JOB_STATUS.EXPIRED,
      ]) {
        expect(
          isJobInternallyVisible({
            job: {
              primaryRecruiterCompanyMemberId: primaryId,
              status,
            },
            companyRole: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
            membershipId: new mongoose.Types.ObjectId(),
          }),
        ).toBe(true);
      }
    });

    it("HTTP: CM cannot list/read DRAFT while Primary and peer PUBLISHED visibility remain (F03)", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.job.slice12.vis@example.com",
        businessRegistrationNumber: "BRN-V5-S12-VIS",
      });
      const primary = await createActiveRecruiterContext({
        email: "recruiter.job.slice12.primary@example.com",
        company: manager.company,
        employeeCode: "NV-S12-VIS-P",
      });
      const peer = await createActiveRecruiterContext({
        email: "recruiter.job.slice12.peer@example.com",
        company: manager.company,
        employeeCode: "NV-S12-VIS-PEER",
      });

      const draft = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: primary.membership._id,
        status: JOB_STATUS.DRAFT,
        title: "Private Draft",
      });
      const pending = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: primary.membership._id,
        status: JOB_STATUS.PENDING_APPROVAL,
        title: "Pending Review",
      });
      const peerPublished = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: peer.membership._id,
        status: JOB_STATUS.PUBLISHED,
        title: "Peer Published",
      });

      const managerToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });
      const primaryToken = await loginAndGetAccessToken(agent, {
        email: primary.user.email,
        password: DEFAULT_PASSWORD,
      });
      const peerToken = await loginAndGetAccessToken(agent, {
        email: peer.user.email,
        password: DEFAULT_PASSWORD,
      });

      const managerList = await agent
        .get("/api/jobs")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(managerList.status).toBe(200);
      const managerIds = managerList.body.jobs.map((job) => job.id);
      expect(managerIds).toContain(pending._id.toString());
      expect(managerIds).toContain(peerPublished._id.toString());
      expect(managerIds).not.toContain(draft._id.toString());

      expect(
        (
          await agent
            .get(`/api/jobs/${draft._id}`)
            .set("Authorization", `Bearer ${managerToken}`)
        ).status,
      ).toBe(403);

      const primaryList = await agent
        .get("/api/jobs")
        .set("Authorization", `Bearer ${primaryToken}`);

      expect(primaryList.status).toBe(200);
      const primaryIds = primaryList.body.jobs.map((job) => job.id);
      expect(primaryIds).toContain(draft._id.toString());
      expect(primaryIds).toContain(pending._id.toString());
      expect(primaryIds).toContain(peerPublished._id.toString());

      const peerDraft = await agent
        .get(`/api/jobs/${draft._id}`)
        .set("Authorization", `Bearer ${peerToken}`);

      expect(peerDraft.status).toBe(403);

      const peerPublishedRead = await agent
        .get(`/api/jobs/${peerPublished._id}`)
        .set("Authorization", `Bearer ${primaryToken}`);

      expect(peerPublishedRead.status).toBe(200);
    });
  });

  describe("shared delete authority matrix (BR-33/BR-34/BR-38/BR-43/TX-04)", () => {
    it("service: DRAFT requires current Primary; PENDING requires CM", () => {
      const companyId = new mongoose.Types.ObjectId();
      const primaryId = new mongoose.Types.ObjectId();
      const peerId = new mongoose.Types.ObjectId();
      const draft = {
        companyId,
        primaryRecruiterCompanyMemberId: primaryId,
        createdByCompanyMemberId: peerId,
        status: JOB_STATUS.DRAFT,
      };
      const pending = {
        companyId,
        primaryRecruiterCompanyMemberId: primaryId,
        createdByCompanyMemberId: primaryId,
        status: JOB_STATUS.PENDING_APPROVAL,
      };

      expect(() => {
        assertPrePublicationDeleteAuthority({
          job: draft,
          companyRole: COMPANY_MEMBER_ROLE.RECRUITER,
          membershipId: primaryId,
          tenantCompanyId: companyId,
        });
      }).not.toThrow();

      expect(() => {
        assertPrePublicationDeleteAuthority({
          job: draft,
          companyRole: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
          membershipId: new mongoose.Types.ObjectId(),
          tenantCompanyId: companyId,
        });
      }).toThrow(AppError);

      expect(() => {
        assertPrePublicationDeleteAuthority({
          job: draft,
          companyRole: COMPANY_MEMBER_ROLE.RECRUITER,
          membershipId: peerId,
          tenantCompanyId: companyId,
        });
      }).toThrow(AppError);

      expect(() => {
        assertPrePublicationDeleteAuthority({
          job: pending,
          companyRole: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
          membershipId: new mongoose.Types.ObjectId(),
          tenantCompanyId: companyId,
        });
      }).not.toThrow();

      expect(() => {
        assertPrePublicationDeleteAuthority({
          job: pending,
          companyRole: COMPANY_MEMBER_ROLE.RECRUITER,
          membershipId: primaryId,
          tenantCompanyId: companyId,
        });
      }).toThrow(AppError);

      expect(() => {
        assertPrePublicationDeleteAuthority({
          job: {
            ...draft,
            status: JOB_STATUS.PUBLISHED,
          },
          companyRole: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
          membershipId: new mongoose.Types.ObjectId(),
          tenantCompanyId: companyId,
        });
      }).toThrow(AppError);
    });

    it("HTTP: historical creator/former Primary cannot delete DRAFT; Primary can (BR-43)", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.job.slice12.delete@example.com",
        businessRegistrationNumber: "BRN-V5-S12-DEL",
      });
      const former = await createActiveRecruiterContext({
        email: "recruiter.job.slice12.former@example.com",
        company: manager.company,
        employeeCode: "NV-S12-DEL-F",
      });
      const current = await createActiveRecruiterContext({
        email: "recruiter.job.slice12.current@example.com",
        company: manager.company,
        employeeCode: "NV-S12-DEL-C",
      });

      const draft = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: former.membership._id,
        primaryRecruiterCompanyMemberId: current.membership._id,
        status: JOB_STATUS.DRAFT,
        title: "Reassigned Draft Ownership",
      });

      const formerToken = await loginAndGetAccessToken(agent, {
        email: former.user.email,
        password: DEFAULT_PASSWORD,
      });
      const currentToken = await loginAndGetAccessToken(agent, {
        email: current.user.email,
        password: DEFAULT_PASSWORD,
      });
      const managerToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });

      expect(
        (
          await agent
            .delete(`/api/jobs/${draft._id}`)
            .set("Authorization", `Bearer ${formerToken}`)
        ).status,
      ).toBe(403);
      expect(
        (
          await agent
            .delete(`/api/jobs/${draft._id}`)
            .set("Authorization", `Bearer ${managerToken}`)
        ).status,
      ).toBe(403);
      expect(await Job.findById(draft._id)).not.toBeNull();

      const deleteResponse = await agent
        .delete(`/api/jobs/${draft._id}`)
        .set("Authorization", `Bearer ${currentToken}`);

      expect(deleteResponse.status).toBe(200);
      expect(await Job.findById(draft._id)).toBeNull();
    });

    it("HTTP: CM PENDING delete remains allowed and F07 reject still CM-only hard-deletes PENDING", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.job.slice12.reject@example.com",
        businessRegistrationNumber: "BRN-V5-S12-REJ",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.job.slice12.reject@example.com",
        company: manager.company,
        employeeCode: "NV-S12-REJ",
      });
      const catalog = await seedCatalog();

      const recruiterToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });
      const managerToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });

      const createPending = async (title) => {
        const createResponse = await agent
          .post("/api/jobs")
          .set("Authorization", `Bearer ${recruiterToken}`)
          .send(buildCompleteContent(catalog, { title }));

        expect(createResponse.status).toBe(201);

        const submitResponse = await agent
          .post(`/api/jobs/${createResponse.body.job.id}/submit`)
          .set("Authorization", `Bearer ${recruiterToken}`);

        expect(submitResponse.status).toBe(200);
        return submitResponse.body.job;
      };

      const pendingForManualDelete = await createPending("Manual Delete Pending");
      const pendingForReject = await createPending("Reject Pending");

      const recruiterManualDelete = await agent
        .delete(`/api/jobs/${pendingForManualDelete.id}`)
        .set("Authorization", `Bearer ${recruiterToken}`);

      expect(recruiterManualDelete.status).toBe(403);
      expect(await Job.findById(pendingForManualDelete.id)).not.toBeNull();

      const managerManualDelete = await agent
        .delete(`/api/jobs/${pendingForManualDelete.id}`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(managerManualDelete.status).toBe(200);
      expect(await Job.findById(pendingForManualDelete.id)).toBeNull();

      const recruiterReject = await agent
        .post(`/api/jobs/${pendingForReject.id}/reject`)
        .set("Authorization", `Bearer ${recruiterToken}`);

      expect(recruiterReject.status).toBe(403);
      expect(await Job.findById(pendingForReject.id)).not.toBeNull();

      const managerReject = await agent
        .post(`/api/jobs/${pendingForReject.id}/reject`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(managerReject.status).toBe(200);
      expect(await Job.findById(pendingForReject.id)).toBeNull();
    });
  });
});
