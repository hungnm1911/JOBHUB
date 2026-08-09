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
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import Job from "../../src/models/job.model.js";
import {
  buildInternalJobVisibilityFilter,
  isJobInternallyVisible,
} from "../../src/services/job.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
  DEFAULT_PASSWORD,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const createJob = async ({
  companyId,
  createdByCompanyMemberId,
  primaryRecruiterCompanyMemberId = createdByCompanyMemberId,
  status,
  title,
  publishedAt = null,
}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId,
    primaryRecruiterCompanyMemberId,
    status,
    title,
    publishedAt:
      publishedAt ??
      (status === JOB_STATUS.PUBLISHED ? new Date("2026-01-15T00:00:00.000Z") : null),
  });
};

const jobIds = (jobs) => {
  return jobs.map((job) => job.id).sort();
};

describe("V5 Slice 03 — Internal Job visibility (F03)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("canonical visibility boundary", () => {
    it("builds Recruiter filter as current Primary any status OR Company PUBLISHED (BR-36)", () => {
      const companyId = new mongoose.Types.ObjectId();
      const membershipId = new mongoose.Types.ObjectId();

      expect(
        buildInternalJobVisibilityFilter({
          companyId,
          companyRole: COMPANY_MEMBER_ROLE.RECRUITER,
          membershipId,
        }),
      ).toEqual({
        companyId,
        $or: [
          {
            primaryRecruiterCompanyMemberId: membershipId,
          },
          {
            status: JOB_STATUS.PUBLISHED,
          },
        ],
      });
    });

    it("builds Company Manager filter as Company Jobs from PENDING_APPROVAL onward (BR-37)", () => {
      const companyId = new mongoose.Types.ObjectId();
      const membershipId = new mongoose.Types.ObjectId();

      expect(
        buildInternalJobVisibilityFilter({
          companyId,
          companyRole: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
          membershipId,
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
    });

    it("does not treat creator association as Recruiter visibility (BR-43)", () => {
      const membershipId = new mongoose.Types.ObjectId();
      const otherPrimaryId = new mongoose.Types.ObjectId();

      const visible = isJobInternallyVisible({
        job: {
          createdByCompanyMemberId: membershipId,
          primaryRecruiterCompanyMemberId: otherPrimaryId,
          status: JOB_STATUS.DRAFT,
        },
        companyRole: COMPANY_MEMBER_ROLE.RECRUITER,
        membershipId,
      });

      expect(visible).toBe(false);
    });

    it("does not grant Company Manager visibility for DRAFT (BR-37)", () => {
      const visible = isJobInternallyVisible({
        job: {
          primaryRecruiterCompanyMemberId: new mongoose.Types.ObjectId(),
          status: JOB_STATUS.DRAFT,
        },
        companyRole: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
        membershipId: new mongoose.Types.ObjectId(),
      });

      expect(visible).toBe(false);
    });
  });

  describe("GET /api/jobs and GET /api/jobs/:jobId", () => {
    it("lets Recruiter list and read own Primary Jobs in every existing status plus peer PUBLISHED (BR-36)", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.job.vis@example.com",
        businessRegistrationNumber: "BRN-V5-VIS-1",
      });
      const primary = await createActiveRecruiterContext({
        email: "recruiter.job.vis.primary@example.com",
        company: manager.company,
        employeeCode: "NV-VIS-1",
      });
      const peer = await createActiveRecruiterContext({
        email: "recruiter.job.vis.peer@example.com",
        company: manager.company,
        employeeCode: "NV-VIS-2",
      });

      const ownDraft = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: primary.membership._id,
        status: JOB_STATUS.DRAFT,
        title: "Own Draft",
      });
      const ownPending = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: primary.membership._id,
        status: JOB_STATUS.PENDING_APPROVAL,
        title: "Own Pending",
      });
      const ownPublished = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: primary.membership._id,
        status: JOB_STATUS.PUBLISHED,
        title: "Own Published",
      });
      const ownClosed = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: primary.membership._id,
        status: JOB_STATUS.CLOSED,
        title: "Own Closed",
      });
      const ownExpired = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: primary.membership._id,
        status: JOB_STATUS.EXPIRED,
        title: "Own Expired",
      });
      const peerPublished = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: peer.membership._id,
        status: JOB_STATUS.PUBLISHED,
        title: "Peer Published",
      });
      const peerDraft = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: peer.membership._id,
        status: JOB_STATUS.DRAFT,
        title: "Peer Draft",
      });
      const peerPending = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: peer.membership._id,
        status: JOB_STATUS.PENDING_APPROVAL,
        title: "Peer Pending",
      });
      const peerClosed = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: peer.membership._id,
        status: JOB_STATUS.CLOSED,
        title: "Peer Closed",
      });
      const peerExpired = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: peer.membership._id,
        status: JOB_STATUS.EXPIRED,
        title: "Peer Expired",
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: primary.user.email,
        password: DEFAULT_PASSWORD,
      });

      const listResponse = await agent
        .get("/api/jobs")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(listResponse.status).toBe(200);

      const listedIds = jobIds(listResponse.body.jobs);

      expect(listedIds).toEqual(
        jobIds([
          {
            id: ownDraft._id.toString(),
          },
          {
            id: ownPending._id.toString(),
          },
          {
            id: ownPublished._id.toString(),
          },
          {
            id: ownClosed._id.toString(),
          },
          {
            id: ownExpired._id.toString(),
          },
          {
            id: peerPublished._id.toString(),
          },
        ]),
      );

      for (const hiddenId of [
        peerDraft._id.toString(),
        peerPending._id.toString(),
        peerClosed._id.toString(),
        peerExpired._id.toString(),
      ]) {
        expect(listedIds).not.toContain(hiddenId);
      }

      const detailResponse = await agent
        .get(`/api/jobs/${peerPublished._id}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.job).toMatchObject({
        id: peerPublished._id.toString(),
        status: JOB_STATUS.PUBLISHED,
        title: "Peer Published",
        createdByCompanyMemberId: peer.membership._id.toString(),
        primaryRecruiterCompanyMemberId: peer.membership._id.toString(),
      });

      for (const hiddenId of [
        peerDraft._id,
        peerPending._id,
        peerClosed._id,
        peerExpired._id,
      ]) {
        const hiddenResponse = await agent
          .get(`/api/jobs/${hiddenId}`)
          .set("Authorization", `Bearer ${accessToken}`);

        expect(hiddenResponse.status).toBe(403);
      }
    });

    it("does not grant Recruiter visibility from historical creator or former Primary alone (BR-43)", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.job.vis.hist@example.com",
        businessRegistrationNumber: "BRN-V5-VIS-2",
      });
      const former = await createActiveRecruiterContext({
        email: "recruiter.job.vis.former@example.com",
        company: manager.company,
        employeeCode: "NV-VIS-3",
      });
      const current = await createActiveRecruiterContext({
        email: "recruiter.job.vis.current@example.com",
        company: manager.company,
        employeeCode: "NV-VIS-4",
      });

      const reassignedDraft = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: former.membership._id,
        primaryRecruiterCompanyMemberId: current.membership._id,
        status: JOB_STATUS.DRAFT,
        title: "Reassigned Draft",
      });
      const reassignedClosed = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: former.membership._id,
        primaryRecruiterCompanyMemberId: current.membership._id,
        status: JOB_STATUS.CLOSED,
        title: "Reassigned Closed",
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: former.user.email,
        password: DEFAULT_PASSWORD,
      });

      const listResponse = await agent
        .get("/api/jobs")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.jobs).toEqual([]);

      for (const jobId of [reassignedDraft._id, reassignedClosed._id]) {
        const response = await agent
          .get(`/api/jobs/${jobId}`)
          .set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(403);
      }
    });

    it("lets Company Manager list and read same-Company Jobs from PENDING_APPROVAL onward, excluding DRAFT (BR-37)", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.job.vis.cm@example.com",
        businessRegistrationNumber: "BRN-V5-VIS-3",
      });
      const recruiterA = await createActiveRecruiterContext({
        email: "recruiter.job.vis.a@example.com",
        company: manager.company,
        employeeCode: "NV-VIS-5",
      });
      const recruiterB = await createActiveRecruiterContext({
        email: "recruiter.job.vis.b@example.com",
        company: manager.company,
        employeeCode: "NV-VIS-6",
      });

      const draft = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiterA.membership._id,
        status: JOB_STATUS.DRAFT,
        title: "CM Hidden Draft",
      });
      const pending = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiterB.membership._id,
        status: JOB_STATUS.PENDING_APPROVAL,
        title: "CM Visible Pending",
      });
      const published = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiterA.membership._id,
        status: JOB_STATUS.PUBLISHED,
        title: "CM Visible Published",
      });
      const closed = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiterB.membership._id,
        status: JOB_STATUS.CLOSED,
        title: "CM Visible Closed",
      });
      const expired = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiterA.membership._id,
        status: JOB_STATUS.EXPIRED,
        title: "CM Visible Expired",
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });

      const listResponse = await agent
        .get("/api/jobs")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(listResponse.status).toBe(200);
      expect(jobIds(listResponse.body.jobs)).toEqual(
        jobIds([
          {
            id: pending._id.toString(),
          },
          {
            id: published._id.toString(),
          },
          {
            id: closed._id.toString(),
          },
          {
            id: expired._id.toString(),
          },
        ]),
      );
      expect(jobIds(listResponse.body.jobs)).not.toContain(draft._id.toString());

      const draftDetail = await agent
        .get(`/api/jobs/${draft._id}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(draftDetail.status).toBe(403);

      const detailResponse = await agent
        .get(`/api/jobs/${pending._id}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.job).toMatchObject({
        id: pending._id.toString(),
        companyId: manager.company._id.toString(),
        title: "CM Visible Pending",
        status: JOB_STATUS.PENDING_APPROVAL,
        createdByCompanyMemberId: recruiterB.membership._id.toString(),
        primaryRecruiterCompanyMemberId: recruiterB.membership._id.toString(),
      });
    });

    it("rejects cross-tenant Job id lookup and client companyId expansion (BR-38)", async () => {
      const agent = createTestAgent();
      const companyA = await createActiveCompanyManagerContext({
        email: "cm.job.vis.a@example.com",
        businessRegistrationNumber: "BRN-V5-VIS-4A",
      });
      const companyB = await createActiveCompanyManagerContext({
        email: "cm.job.vis.b@example.com",
        businessRegistrationNumber: "BRN-V5-VIS-4B",
      });
      const recruiterA = await createActiveRecruiterContext({
        email: "recruiter.job.vis.tenant.a@example.com",
        company: companyA.company,
        employeeCode: "NV-VIS-7",
      });
      const recruiterB = await createActiveRecruiterContext({
        email: "recruiter.job.vis.tenant.b@example.com",
        company: companyB.company,
        employeeCode: "NV-VIS-8",
      });

      const jobB = await createJob({
        companyId: companyB.company._id,
        createdByCompanyMemberId: recruiterB.membership._id,
        status: JOB_STATUS.PUBLISHED,
        title: "Other Company Job",
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiterA.user.email,
        password: DEFAULT_PASSWORD,
      });

      const crossTenantDetail = await agent
        .get(`/api/jobs/${jobB._id}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(crossTenantDetail.status).toBe(403);

      const expandedList = await agent
        .get("/api/jobs")
        .query({
          companyId: companyB.company._id.toString(),
        })
        .set("Authorization", `Bearer ${accessToken}`);

      expect(expandedList.status).toBe(403);

      const expandedDetail = await agent
        .get(`/api/jobs/${jobB._id}`)
        .query({
          companyId: companyB.company._id.toString(),
        })
        .set("Authorization", `Bearer ${accessToken}`);

      expect(expandedDetail.status).toBe(403);
    });

    it("rejects Candidate and unknown Job ids", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.job.vis.denied@example.com",
        businessRegistrationNumber: "BRN-V5-VIS-5",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.job.vis.denied@example.com",
        company: manager.company,
        employeeCode: "NV-VIS-9",
      });
      await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        status: JOB_STATUS.DRAFT,
        title: "Hidden From Candidate",
      });

      const candidate = await createVerifiedUser({
        email: "candidate.job.vis@example.com",
        role: USER_ROLE.CANDIDATE,
      });
      const candidateToken = await loginAndGetAccessToken(agent, {
        email: candidate.user.email,
        password: DEFAULT_PASSWORD,
      });

      const candidateList = await agent
        .get("/api/jobs")
        .set("Authorization", `Bearer ${candidateToken}`);

      expect(candidateList.status).toBe(403);

      const recruiterToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });
      const missing = await agent
        .get(`/api/jobs/${new mongoose.Types.ObjectId()}`)
        .set("Authorization", `Bearer ${recruiterToken}`);

      expect(missing.status).toBe(404);
    });
  });
});
