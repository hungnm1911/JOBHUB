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
import JOB_STATUS from "../../src/constants/job-status.js";
import LOCATION from "../../src/constants/location.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import Job from "../../src/models/job.model.js";
import { assertCompanyManagerJobApprovalAuthority } from "../../src/services/job.service.js";
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

describe("V5 Slice 05 — Company Manager pending-review access (F05)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  const createPendingReviewJob = async ({
    companyId,
    createdByCompanyMemberId,
    primaryRecruiterCompanyMemberId = createdByCompanyMemberId,
    overrides = {},
  }) => {
    return Job.create({
      companyId,
      createdByCompanyMemberId,
      primaryRecruiterCompanyMemberId,
      status: JOB_STATUS.PENDING_APPROVAL,
      publishedAt: null,
      title: "Pending Review Backend Role",
      jobDescription: "Submitted Job Description for Manager review.",
      requiredSkills: ["Node.js", "MongoDB"],
      salaryText: "Negotiate",
      location: LOCATION.HA_NOI,
      employmentType: EMPLOYMENT_TYPE.FULL_TIME,
      workModes: [WORK_MODE.HYBRID],
      ...overrides,
    });
  };

  describe("pending-review read path (reuses F03 internal visibility)", () => {
    it("lets same-Company Manager read PENDING_APPROVAL content, status, creator, and Primary (BR-37)", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.job.f05.review@example.com",
        businessRegistrationNumber: "BRN-V5-F05-1",
      });
      const creator = await createActiveRecruiterContext({
        email: "recruiter.job.f05.creator@example.com",
        company: manager.company,
        employeeCode: "NV-F05-1",
      });
      const primary = await createActiveRecruiterContext({
        email: "recruiter.job.f05.primary@example.com",
        company: manager.company,
        employeeCode: "NV-F05-2",
      });

      const job = await createPendingReviewJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: creator.membership._id,
        primaryRecruiterCompanyMemberId: primary.membership._id,
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });

      const listResponse = await agent
        .get("/api/jobs")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.jobs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: job._id.toString(),
            status: JOB_STATUS.PENDING_APPROVAL,
            title: "Pending Review Backend Role",
          }),
        ]),
      );

      const detailResponse = await agent
        .get(`/api/jobs/${job._id}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.job).toMatchObject({
        id: job._id.toString(),
        companyId: manager.company._id.toString(),
        status: JOB_STATUS.PENDING_APPROVAL,
        title: "Pending Review Backend Role",
        jobDescription: "Submitted Job Description for Manager review.",
        requiredSkills: ["Node.js", "MongoDB"],
        salaryText: "Negotiate",
        location: LOCATION.HA_NOI,
        employmentType: EMPLOYMENT_TYPE.FULL_TIME,
        workModes: [WORK_MODE.HYBRID],
        createdByCompanyMemberId: creator.membership._id.toString(),
        primaryRecruiterCompanyMemberId: primary.membership._id.toString(),
        publishedAt: null,
      });
    });

    it("keeps PENDING_APPROVAL content immutable and blocks cross-tenant Manager read (BR-19/BR-38)", async () => {
      const agent = createTestAgent();
      const companyA = await createActiveCompanyManagerContext({
        email: "cm.job.f05.a@example.com",
        businessRegistrationNumber: "BRN-V5-F05-2A",
      });
      const companyB = await createActiveCompanyManagerContext({
        email: "cm.job.f05.b@example.com",
        businessRegistrationNumber: "BRN-V5-F05-2B",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.job.f05.immutable@example.com",
        company: companyA.company,
        employeeCode: "NV-F05-3",
      });

      const job = await createPendingReviewJob({
        companyId: companyA.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
      });

      const recruiterToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });
      const mutateResponse = await agent
        .patch(`/api/jobs/${job._id}`)
        .set("Authorization", `Bearer ${recruiterToken}`)
        .send({ title: "Mutated After Submit" });

      expect(mutateResponse.status).toBe(409);
      expect(mutateResponse.body.error.message).toMatch(
        /only be edited while.*DRAFT/i,
      );

      const managerToken = await loginAndGetAccessToken(agent, {
        email: companyA.user.email,
        password: DEFAULT_PASSWORD,
      });
      const managerMutateResponse = await agent
        .patch(`/api/jobs/${job._id}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ title: "Manager Edit Attempt" });

      expect(managerMutateResponse.status).toBe(403);

      const foreignToken = await loginAndGetAccessToken(agent, {
        email: companyB.user.email,
        password: DEFAULT_PASSWORD,
      });
      const foreignResponse = await agent
        .get(`/api/jobs/${job._id}`)
        .set("Authorization", `Bearer ${foreignToken}`);

      expect(foreignResponse.status).toBe(403);
      expect(foreignResponse.body.error.message).toMatch(/cross-tenant/i);

      const persisted = await Job.findById(job._id).lean();
      expect(persisted.title).toBe("Pending Review Backend Role");
      expect(persisted.status).toBe(JOB_STATUS.PENDING_APPROVAL);
    });
  });

  describe("approval-decision authority boundary (BR-20)", () => {
    it("allows only same-Company Manager when Job is PENDING_APPROVAL", () => {
      const companyId = new mongoose.Types.ObjectId();
      const job = {
        companyId,
        status: JOB_STATUS.PENDING_APPROVAL,
      };

      expect(() => {
        assertCompanyManagerJobApprovalAuthority({
          job,
          companyRole: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
          tenantCompanyId: companyId,
        });
      }).not.toThrow();
    });

    it("rejects Recruiter, foreign Company, and non-PENDING_APPROVAL Jobs", () => {
      const companyId = new mongoose.Types.ObjectId();
      const foreignCompanyId = new mongoose.Types.ObjectId();
      const pendingJob = {
        companyId,
        status: JOB_STATUS.PENDING_APPROVAL,
      };

      try {
        assertCompanyManagerJobApprovalAuthority({
          job: pendingJob,
          companyRole: COMPANY_MEMBER_ROLE.RECRUITER,
          tenantCompanyId: companyId,
        });
        expect.unreachable("Recruiter must not hold approval authority");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(403);
        expect(error.message).toMatch(/Company Manager can approve or reject/i);
      }

      try {
        assertCompanyManagerJobApprovalAuthority({
          job: pendingJob,
          companyRole: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
          tenantCompanyId: foreignCompanyId,
        });
        expect.unreachable("Cross-tenant Manager must be denied");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(403);
        expect(error.message).toMatch(/cross-tenant/i);
      }

      for (const status of [
        JOB_STATUS.DRAFT,
        JOB_STATUS.PUBLISHED,
        JOB_STATUS.CLOSED,
        JOB_STATUS.EXPIRED,
      ]) {
        try {
          assertCompanyManagerJobApprovalAuthority({
            job: {
              companyId,
              status,
            },
            companyRole: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
            tenantCompanyId: companyId,
          });
          expect.unreachable(`${status} must not allow approval decisions`);
        } catch (error) {
          expect(error).toBeInstanceOf(AppError);
          expect(error.statusCode).toBe(409);
          expect(error.message).toMatch(/PENDING_APPROVAL/i);
          expect(error.details.status).toBe(status);
        }
      }
    });
  });
});
