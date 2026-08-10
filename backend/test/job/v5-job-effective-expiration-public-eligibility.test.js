import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import COMPANY_APPROVAL_STATUS from "../../src/constants/company-approval-status.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import LOCATION from "../../src/constants/location.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import { migrate as migrateExperienceLevels } from "../../src/database/migrations/v4-experience-level-dataset.js";
import CompanyMember from "../../src/models/company-member.model.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import Job from "../../src/models/job.model.js";
import {
  createFieldCategory,
  createPositionCategory,
} from "../../src/services/category.service.js";
import {
  expirePublishedJobIfDue,
  findOutstandingPrimaryResponsibility,
  isJobEffectivelyPublished,
  isJobPubliclyEligible,
  resolveEffectiveJobStatus,
} from "../../src/services/job.service.js";
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

describe("V5 Slice 11 — Effective expiration + public eligibility (F10/F11)", () => {
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

  const createPublishedJob = async ({
    agent,
    manager,
    recruiter,
    content,
  }) => {
    const recruiterToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const createResponse = await agent
      .post("/api/jobs")
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send(content);

    expect(createResponse.status).toBe(201);

    const submitResponse = await agent
      .post(`/api/jobs/${createResponse.body.job.id}/submit`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(submitResponse.status).toBe(200);

    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const approveResponse = await agent
      .post(`/api/jobs/${createResponse.body.job.id}/approve`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.job.status).toBe(JOB_STATUS.PUBLISHED);

    return {
      managerToken,
      recruiterToken,
      job: approveResponse.body.job,
    };
  };

  const assertHistoricalFieldsPreserved = (before, after) => {
    expect(after.companyId.toString()).toBe(before.companyId.toString());
    expect(after.createdByCompanyMemberId.toString()).toBe(
      before.createdByCompanyMemberId.toString(),
    );
    expect(after.primaryRecruiterCompanyMemberId.toString()).toBe(
      before.primaryRecruiterCompanyMemberId.toString(),
    );
    expect(after.publishedAt.toISOString()).toBe(
      before.publishedAt.toISOString(),
    );
    expect(after.title).toBe(before.title);
    expect(after.jobDescription).toBe(before.jobDescription);
    expect(after.requiredSkills).toEqual(before.requiredSkills);
    expect(after.salaryText).toBe(before.salaryText);
    expect(after.location).toBe(before.location);
    expect(after.employmentType).toBe(before.employmentType);
    expect(after.workModes).toEqual(before.workModes);
    expect(after.experienceLevelId.toString()).toBe(
      before.experienceLevelId.toString(),
    );
    expect(after.applicationDeadline.toISOString()).toBe(
      before.applicationDeadline.toISOString(),
    );
  };

  it("treats PUBLISHED past deadline as effective EXPIRED without requiring persist (BR-30/BR-31)", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    const pastDeadline = new Date("2026-06-01T00:00:00.000Z");
    const futureDeadline = new Date("2026-06-02T00:00:00.000Z");

    const publishedPast = {
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: pastDeadline,
    };
    const publishedFuture = {
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: futureDeadline,
    };
    const closedPast = {
      status: JOB_STATUS.CLOSED,
      applicationDeadline: pastDeadline,
    };
    const pendingPast = {
      status: JOB_STATUS.PENDING_APPROVAL,
      applicationDeadline: pastDeadline,
    };
    const draft = {
      status: JOB_STATUS.DRAFT,
      applicationDeadline: null,
    };
    const expired = {
      status: JOB_STATUS.EXPIRED,
      applicationDeadline: pastDeadline,
    };

    expect(resolveEffectiveJobStatus(publishedPast, now)).toBe(
      JOB_STATUS.EXPIRED,
    );
    expect(isJobEffectivelyPublished(publishedPast, now)).toBe(false);

    expect(resolveEffectiveJobStatus(publishedFuture, now)).toBe(
      JOB_STATUS.PUBLISHED,
    );
    expect(isJobEffectivelyPublished(publishedFuture, now)).toBe(true);

    expect(resolveEffectiveJobStatus(closedPast, now)).toBe(JOB_STATUS.CLOSED);
    expect(resolveEffectiveJobStatus(pendingPast, now)).toBe(
      JOB_STATUS.PENDING_APPROVAL,
    );
    expect(resolveEffectiveJobStatus(draft, now)).toBe(JOB_STATUS.DRAFT);
    expect(resolveEffectiveJobStatus(expired, now)).toBe(JOB_STATUS.EXPIRED);
  });

  it("applies canonical public-eligibility only for effective PUBLISHED + ACTIVE Company (BR-35/BR-40)", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.public.elig@example.com",
      businessRegistrationNumber: "BRN-V5-F10-1",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.public.elig@example.com",
      company: manager.company,
      employeeCode: "NV-F10-1",
    });
    const catalog = await seedCatalog();
    const now = new Date("2026-06-01T12:00:00.000Z");
    const futureDeadline = new Date("2026-06-10T00:00:00.000Z");
    const pastDeadline = new Date("2026-05-01T00:00:00.000Z");

    const publishedEligible = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: recruiter.membership._id,
      primaryRecruiterCompanyMemberId: recruiter.membership._id,
      status: JOB_STATUS.PUBLISHED,
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      title: "Eligible Job",
      jobDescription: "Public opportunity",
      requiredSkills: ["Node.js"],
      salaryText: "Negotiate",
      fieldCategoryIds: [catalog.field.id],
      positionCategoryIds: [catalog.position.id],
      location: LOCATION.HA_NOI,
      employmentType: EMPLOYMENT_TYPE.FULL_TIME,
      workModes: [WORK_MODE.HYBRID],
      experienceLevelId: catalog.experienceLevelId,
      applicationDeadline: futureDeadline,
    });

    expect(
      isJobPubliclyEligible({
        job: publishedEligible,
        company: manager.company,
        now,
      }),
    ).toBe(true);

    const cases = [
      {
        status: JOB_STATUS.DRAFT,
        applicationDeadline: futureDeadline,
        publishedAt: null,
      },
      {
        status: JOB_STATUS.PENDING_APPROVAL,
        applicationDeadline: futureDeadline,
        publishedAt: null,
      },
      {
        status: JOB_STATUS.CLOSED,
        applicationDeadline: futureDeadline,
        publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        status: JOB_STATUS.EXPIRED,
        applicationDeadline: pastDeadline,
        publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        status: JOB_STATUS.PUBLISHED,
        applicationDeadline: pastDeadline,
        publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];

    for (const entry of cases) {
      const job = await Job.create({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        primaryRecruiterCompanyMemberId: recruiter.membership._id,
        title: `${entry.status} Job`,
        ...entry,
      });

      expect(
        isJobPubliclyEligible({
          job,
          company: manager.company,
          now,
        }),
      ).toBe(false);
    }

    expect(
      isJobPubliclyEligible({
        job: null,
        company: manager.company,
        now,
      }),
    ).toBe(false);

    expect(
      isJobPubliclyEligible({
        job: publishedEligible,
        company: null,
        now,
      }),
    ).toBe(false);

    expect(
      isJobPubliclyEligible({
        job: publishedEligible,
        company: {
          approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
          operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
        },
        now,
      }),
    ).toBe(false);

    expect(
      isJobPubliclyEligible({
        job: publishedEligible,
        company: {
          approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
          operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
        },
        now,
      }),
    ).toBe(false);
  });

  it("rejects public eligibility when Company argument is not the Job owner (F11/BR-35/BR-38)", async () => {
    const owner = await createActiveCompanyManagerContext({
      email: "cm.job.public.owner@example.com",
      businessRegistrationNumber: "BRN-V5-F11-OWN-A",
    });
    const foreign = await createActiveCompanyManagerContext({
      email: "cm.job.public.foreign@example.com",
      businessRegistrationNumber: "BRN-V5-F11-OWN-B",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.public.owner@example.com",
      company: owner.company,
      employeeCode: "NV-F11-OWN-A",
    });
    const catalog = await seedCatalog();
    const now = new Date("2026-06-01T12:00:00.000Z");
    const futureDeadline = new Date("2026-06-10T00:00:00.000Z");

    const jobOwnedByA = await Job.create({
      companyId: owner.company._id,
      createdByCompanyMemberId: recruiter.membership._id,
      primaryRecruiterCompanyMemberId: recruiter.membership._id,
      status: JOB_STATUS.PUBLISHED,
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      title: "Owner A Job",
      jobDescription: "Must not become eligible via foreign Company B",
      requiredSkills: ["Node.js"],
      salaryText: "Negotiate",
      fieldCategoryIds: [catalog.field.id],
      positionCategoryIds: [catalog.position.id],
      location: LOCATION.HA_NOI,
      employmentType: EMPLOYMENT_TYPE.FULL_TIME,
      workModes: [WORK_MODE.HYBRID],
      experienceLevelId: catalog.experienceLevelId,
      applicationDeadline: futureDeadline,
    });

    expect(owner.company._id.toString()).not.toBe(foreign.company._id.toString());
    expect(owner.company.approvalStatus).toBe(COMPANY_APPROVAL_STATUS.APPROVED);
    expect(owner.company.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.ACTIVE,
    );
    expect(foreign.company.approvalStatus).toBe(COMPANY_APPROVAL_STATUS.APPROVED);
    expect(foreign.company.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.ACTIVE,
    );

    // Ownership mismatch is the direct cause: both Companies are publicly
    // operational, but Company B is not Job A's owner.
    expect(
      isJobPubliclyEligible({
        job: jobOwnedByA,
        company: foreign.company,
        now,
      }),
    ).toBe(false);

    expect(
      isJobPubliclyEligible({
        job: jobOwnedByA,
        company: owner.company,
        now,
      }),
    ).toBe(true);

    // Foreign ACTIVE Company must not rescue eligibility when the owner is not
    // in the canonical public-operational state.
    owner.company.operationalStatus = COMPANY_OPERATIONAL_STATUS.LOCKED;
    await owner.company.save();

    expect(
      isJobPubliclyEligible({
        job: jobOwnedByA,
        company: owner.company,
        now,
      }),
    ).toBe(false);

    expect(
      isJobPubliclyEligible({
        job: jobOwnedByA,
        company: foreign.company,
        now,
      }),
    ).toBe(false);
  });

  it("persists PUBLISHED → EXPIRED atomically without mutating ownership/content (F10/TX-02/BR-32)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.expire.persist@example.com",
      businessRegistrationNumber: "BRN-V5-F10-2",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.job.expire.persist@example.com",
      company: manager.company,
      employeeCode: "NV-F10-2",
    });
    const catalog = await seedCatalog();
    const { job: published } = await createPublishedJob({
      agent,
      manager,
      recruiter: primary,
      content: buildCompleteContent(catalog),
    });

    const before = await Job.findById(published.id).lean();
    const jobCountBefore = await Job.countDocuments();
    const now = new Date(before.applicationDeadline.getTime() + 1000);

    const expired = await expirePublishedJobIfDue({
      jobId: published.id,
      now,
    });

    expect(expired.status).toBe(JOB_STATUS.EXPIRED);
    expect(expired.companyId).toBe(manager.company._id.toString());
    expect(expired.primaryRecruiterCompanyMemberId).toBe(
      primary.membership._id.toString(),
    );
    expect(expired.createdByCompanyMemberId).toBe(
      primary.membership._id.toString(),
    );
    expect(new Date(expired.publishedAt).toISOString()).toBe(
      before.publishedAt.toISOString(),
    );
    expect(expired.title).toBe(before.title);

    const after = await Job.findById(published.id).lean();
    expect(after).not.toBeNull();
    expect(after.status).toBe(JOB_STATUS.EXPIRED);
    assertHistoricalFieldsPreserved(before, after);
    expect(await Job.countDocuments()).toBe(jobCountBefore);

    await expect(
      expirePublishedJobIfDue({
        jobId: published.id,
        now,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("refuses expiration persist for non-PUBLISHED or future-deadline Jobs", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.expire.refuse@example.com",
      businessRegistrationNumber: "BRN-V5-F10-3",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.job.expire.refuse@example.com",
      company: manager.company,
      employeeCode: "NV-F10-3",
    });
    const now = new Date("2026-06-01T12:00:00.000Z");

    const draft = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      status: JOB_STATUS.DRAFT,
      title: null,
      applicationDeadline: new Date("2026-05-01T00:00:00.000Z"),
    });

    await expect(
      expirePublishedJobIfDue({
        jobId: draft._id.toString(),
        now,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    const pending = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      status: JOB_STATUS.PENDING_APPROVAL,
      title: "Pending",
      applicationDeadline: new Date("2026-05-01T00:00:00.000Z"),
    });

    await expect(
      expirePublishedJobIfDue({
        jobId: pending._id.toString(),
        now,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
    expect((await Job.findById(pending._id).lean()).status).toBe(
      JOB_STATUS.PENDING_APPROVAL,
    );

    const futurePublished = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      status: JOB_STATUS.PUBLISHED,
      title: "Still open",
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      applicationDeadline: new Date("2026-07-01T00:00:00.000Z"),
    });

    await expect(
      expirePublishedJobIfDue({
        jobId: futurePublished._id.toString(),
        now,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
    expect((await Job.findById(futurePublished._id).lean()).status).toBe(
      JOB_STATUS.PUBLISHED,
    );

    await expect(
      expirePublishedJobIfDue({
        jobId: new mongoose.Types.ObjectId().toString(),
        now,
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("clears BR-41 outstanding responsibility for effective and persisted EXPIRED Jobs", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.expire.br41@example.com",
      businessRegistrationNumber: "BRN-V5-F10-4",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.job.expire.br41@example.com",
      company: manager.company,
      employeeCode: "NV-F10-4",
    });
    const catalog = await seedCatalog();
    const { managerToken, job: published } = await createPublishedJob({
      agent,
      manager,
      recruiter: primary,
      content: buildCompleteContent(catalog),
    });

    const pastDeadline = new Date(Date.now() - 60 * 1000);
    await Job.findByIdAndUpdate(published.id, {
      applicationDeadline: pastDeadline,
    });

    const before = await Job.findById(published.id).lean();
    expect(before.status).toBe(JOB_STATUS.PUBLISHED);

    const outstandingWhilePastDeadline =
      await findOutstandingPrimaryResponsibility({
        companyId: manager.company._id,
        primaryRecruiterCompanyMemberId: primary.membership._id,
      });

    expect(outstandingWhilePastDeadline).toBeNull();

    const lockWhileEffectivelyExpired = await agent
      .post(`/api/company/recruiters/${primary.user._id.toString()}/lock`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(lockWhileEffectivelyExpired.status).toBe(200);
    expect(
      (await CompanyMember.findById(primary.membership._id).lean()).status,
    ).toBe(COMPANY_MEMBER_STATUS.LOCKED);

    await CompanyMember.findByIdAndUpdate(primary.membership._id, {
      status: COMPANY_MEMBER_STATUS.ACTIVE,
    });

    const stillPublishedPastDeadline = await Job.findById(published.id).lean();
    expect(stillPublishedPastDeadline.status).toBe(JOB_STATUS.PUBLISHED);

    const expired = await expirePublishedJobIfDue({
      jobId: published.id,
    });

    expect(expired.status).toBe(JOB_STATUS.EXPIRED);

    const outstandingAfterPersist = await findOutstandingPrimaryResponsibility({
      companyId: manager.company._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
    });

    expect(outstandingAfterPersist).toBeNull();

    const lockAfterPersist = await agent
      .post(`/api/company/recruiters/${primary.user._id.toString()}/lock`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(lockAfterPersist.status).toBe(200);
    expect((await Job.findById(published.id).lean()).status).toBe(
      JOB_STATUS.EXPIRED,
    );
  });

  it("keeps future-deadline PUBLISHED Jobs outstanding for BR-41", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.expire.br41.future@example.com",
      businessRegistrationNumber: "BRN-V5-F10-5",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.job.expire.br41.future@example.com",
      company: manager.company,
      employeeCode: "NV-F10-5",
    });
    const catalog = await seedCatalog();
    const { managerToken, job: published } = await createPublishedJob({
      agent,
      manager,
      recruiter: primary,
      content: buildCompleteContent(catalog),
    });

    const outstanding = await findOutstandingPrimaryResponsibility({
      companyId: manager.company._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
    });

    expect(outstanding).not.toBeNull();
    expect(outstanding._id.toString()).toBe(published.id);

    const blocked = await agent
      .post(`/api/company/recruiters/${primary.user._id.toString()}/lock`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(blocked.status).toBe(409);
    expect((await Job.findById(published.id).lean()).status).toBe(
      JOB_STATUS.PUBLISHED,
    );
  });
});
