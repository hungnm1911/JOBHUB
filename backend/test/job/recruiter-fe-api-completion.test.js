import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import Conversation from "../../src/models/conversation.model.js";
import Message from "../../src/models/message.model.js";
import Company from "../../src/models/company.model.js";
import Job from "../../src/models/job.model.js";
import Application from "../../src/models/application.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import User from "../../src/models/user.model.js";
import JobInvitation from "../../src/models/job-invitation.model.js";
import { createNotificationEvent, materializeNotificationEvent } from "../../src/services/notification.service.js";
import { createActiveCompanyManagerContext, createActiveRecruiterContext,
  createVerifiedUser, loginAndGetAccessToken } from "../helpers/auth-fixtures.js";
import { clearDatabase, connectTestDatabase, createTestAgent, disconnectTestDatabase } from "../helpers/database.js";

describe("Recruiter FE API completion", () => {
  let manager, primary, supporting, available, job, agent, token;
  beforeAll(connectTestDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);
  beforeEach(async () => {
    manager = await createActiveCompanyManagerContext();
    const recruit = (email, employeeCode, fullName) => createActiveRecruiterContext({
      company: manager.company, email, employeeCode, fullName });
    primary = await recruit("primary@example.com", "P", "Primary");
    supporting = await recruit("support@example.com", "S", "Supporting");
    available = await recruit("available@example.com", "A", "Available");
    job = await Job.create({ companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
      title: "Node Engineer", status: "PUBLISHED", salary: { type: "NEGOTIABLE" },
      publishedAt: new Date(), applicationDeadline: new Date(Date.now() + 86400000) });
    agent = createTestAgent();
    token = await loginAndGetAccessToken(agent, { email: primary.user.email, password: primary.password });
  });
  const get = (path, accessToken = token) => agent.get(path).set("Authorization", `Bearer ${accessToken}`);
  const login = (actor) => loginAndGetAccessToken(agent, { email: actor.user.email, password: actor.password });
  const snapshot = () => ({ sourceCandidateCvId: new mongoose.Types.ObjectId(), name: "Snapshot",
    sourceType: "UPLOADED", capturedAt: new Date(), pdfFile: {
      storageKey: "applications/submitted-cv-snapshots/review.pdf", originalFileName: "cv.pdf",
      mimeType: "application/pdf", sizeBytes: 2048, pageCount: 1 } });
  const application = async (name, assignee = null) => {
    const candidate = await createVerifiedUser({ email: `${name}@example.com`, fullName: name });
    const row = await Application.create({ candidateUserId: candidate.user._id, jobId: job._id,
      source: "DIRECT_APPLICATION", status: "APPLIED", appliedAt: new Date(), submittedCvSnapshot: snapshot() });
    if (assignee) await Application.updateOne({ _id: row._id }, { $set: { assignedRecruiterCompanyMemberId: assignee } });
    return row;
  };

  it("lists only readable conversations and retains frozen history without granting send authority", async () => {
    const row = await application("ChatAlice", primary.membership._id);
    const conversation = await Conversation.create({ applicationId: row._id });
    for (const content of ["one", "two"]) await Message.create({ conversationId: conversation._id,
      type: "NORMAL", senderUserId: primary.user._id, senderCompanyMemberId: primary.membership._id, content });
    const inbox = await get("/api/jobs/my-conversations?q=ChatAlice&limit=1");
    expect(inbox.status).toBe(200);
    expect(inbox.body.pagination.total).toBe(1);
    expect(inbox.body.conversations[0]).toMatchObject({ applicationId: row.id, mode: "ACTIVE",
      authority: { canRead: true, canSendNormal: true } });
    const history = await get(`/api/jobs/my-applications/${row.id}/conversation?limit=1&page=2`);
    expect(history.status).toBe(200);
    expect(history.body.messages).toHaveLength(1);
    expect(history.body.pagination.total).toBe(2);
    expect((await get("/api/jobs/my-conversations", await login(supporting))).body.pagination.total).toBe(0);
    await get("/api/jobs/my-conversations", await login(manager)).expect(403);
    await Company.updateOne({ _id: manager.company._id }, { $set: { operationalStatus: "LOCKED" } });
    const frozen = await get("/api/jobs/my-conversations");
    expect(frozen.status).toBe(200);
    expect(frozen.body.conversations[0]).toMatchObject({ mode: "FROZEN_COMPANY",
      authority: { canRead: true, canSendNormal: false } });
    await get("/api/jobs/my-applications").expect(403);
    await Application.updateOne({ _id: row._id }, { $set: { assignedRecruiterCompanyMemberId: null } });
    expect((await get("/api/jobs/my-conversations")).body.conversations).toEqual([]);
  });

  it("returns only eligible same-company non-team Supporting options with minimal fields", async () => {
    await User.updateOne({ _id: available.user._id }, { $set: { mustChangePassword: true } });
    expect((await get(`/api/jobs/${job.id}/team/supporting-options`)).body.recruiters).toEqual([]);
    await User.updateOne({ _id: available.user._id }, { $set: { mustChangePassword: false } });
    await createActiveRecruiterContext({ email: "foreign@example.com" });
    const response = await get(`/api/jobs/${job.id}/team/supporting-options?q=avail&limit=1`);
    expect(response.status).toBe(200);
    expect(response.body.recruiters).toEqual([{ companyMemberId: available.membership.id,
      fullName: "Available", jobTitle: "Recruiter", avatarUrl: null }]);
    expect(response.body.pagination).toEqual({ page: 1, limit: 1, total: 1, totalPages: 1 });
    await CompanyMember.updateOne({ _id: available.membership._id }, { $set: { status: "LOCKED" } });
    expect((await get(`/api/jobs/${job.id}/team/supporting-options`)).body.pagination.total).toBe(0);
  });

  it("uses membership identity to keep equal-name chooser pages stable and distinct", async () => {
    const duplicate = await createActiveRecruiterContext({ email: "duplicate@example.com", employeeCode: "D",
      fullName: "Available", company: manager.company });
    const first = await get(`/api/jobs/${job.id}/team/supporting-options?limit=1`);
    const second = await get(`/api/jobs/${job.id}/team/supporting-options?limit=1&page=2`);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.pagination.total).toBe(2);
    expect([first.body.recruiters[0].companyMemberId, second.body.recruiters[0].companyMemberId])
      .toEqual([available.membership.id, duplicate.membership.id].sort());
  });

  it("enforces actor, tenant, lifecycle and query boundaries on both options endpoints", async () => {
    const supportToken = await login(supporting);
    const foreign = await createActiveRecruiterContext({ email: "foreign@example.com" });
    for (const path of ["team/supporting-options", "assignment-options"]) {
      await get(`/api/jobs/${job.id}/${path}`, supportToken).expect(403);
      await get(`/api/jobs/${job.id}/${path}`, await login(foreign)).expect(403);
      await get(`/api/jobs/${job.id}/${path}`, await login(manager)).expect(200);
      for (const query of ["limit=101", "page=0", "page=1&page=2", "sort=email", "q="]) {
        await get(`/api/jobs/${job.id}/${path}?${query}`).expect(400);
      }
      await agent.get(`/api/jobs/${job.id}/${path}`).expect(401);
    }
    await Job.updateOne({ _id: job._id }, { $set: { status: "CLOSED" } });
    await get(`/api/jobs/${job.id}/team/supporting-options`).expect(409);
    const options = await get(`/api/jobs/${job.id}/assignment-options`);
    expect(options.status).toBe(200);
    expect(options.body.recruiters.map((item) => item.companyMemberId).sort()).toEqual(
      [primary.membership.id, supporting.membership.id].sort());
    await get(`/api/jobs/${job.id}/team`).expect(403);
    await User.updateOne({ _id: supporting.user._id }, { $set: { status: "LOCKED" } });
    expect((await get(`/api/jobs/${job.id}/assignment-options`)).body.recruiters.map((item) => item.companyMemberId))
      .toEqual([primary.membership.id]);
  });

  it("adds safe display summaries without changing team-read or mutation authority", async () => {
    const response = await get(`/api/jobs/${job.id}/team`, await login(supporting));
    expect(response.status).toBe(200);
    expect(response.body.team.primaryRecruiter.companyMemberId).toBe(primary.membership.id);
    expect(response.body.team.supportingRecruiters[0].fullName).toBe("Supporting");
    expect(JSON.stringify(response.body)).not.toContain("@example.com");
    await get(`/api/jobs/${job.id}/team`, await login(available)).expect(403);
  });

  it("lets only current Primary drill into a Job Application, preserving its snapshot and assignee", async () => {
    const row = await application("Alice", supporting.membership._id);
    const response = await get(`/api/jobs/${job.id}/applications/${row.id}`);
    expect(response.status).toBe(200);
    expect(response.body.application).toMatchObject({ id: row.id, status: "APPLIED",
      assignedRecruiterCompanyMemberId: supporting.membership.id, candidate: { fullName: "Alice" },
      availability: { status: "NOT_SUBMITTED" }, interviewSchedules: [] });
    expect(response.body.application.submittedCvSnapshot.pdfFile).not.toHaveProperty("storageKey");
    await get(`/api/jobs/${job.id}/applications/${row.id}`, await login(supporting)).expect(403);
    await get(`/api/jobs/${job.id}/applications/${row.id}`, await login(manager)).expect(403);
    await get(`/api/jobs/${job.id}/applications/invalid`).expect(404);
    await get(`/api/jobs/my-applications/${row.id}`).expect(403);
    await Job.updateOne({ _id: job._id }, { $set: { status: "CLOSED" } });
    await get(`/api/jobs/${job.id}/applications/${row.id}`).expect(200);
    const other = await Job.create({ companyId: manager.company._id, createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id });
    await get(`/api/jobs/${other.id}/applications/${row.id}`).expect(404);
  });

  it("filters before paging Applications and preserves full workload and legacy reads", async () => {
    const alice = await application("Alice");
    await application("Bob", primary.membership._id);
    const response = await get(`/api/jobs/${job.id}/applications?q=ali&status=APPLIED&assigneeCompanyMemberId=NONE&limit=1`);
    expect(response.status).toBe(200);
    expect(response.body.applications.map((row) => row.id)).toEqual([alice.id]);
    expect(response.body.pagination.total).toBe(1);
    expect((await get(`/api/jobs/${job.id}/applications`)).body).not.toHaveProperty("pagination");
    const mine = await get("/api/jobs/my-applications?q=Bob&limit=1&page=2");
    expect(mine.body.applications).toEqual([]);
    expect(mine.body.pagination).toMatchObject({ total: 1, totalPages: 1 });
    expect(mine.body.currentWorkloadCount).toBe(1);
    const assigned = await get(`/api/jobs/${job.id}/applications?assigneeCompanyMemberId=${primary.membership.id.toUpperCase()}`);
    expect(assigned.status).toBe(200);
    expect(assigned.body.pagination.total).toBe(1);
    await get("/api/jobs/my-applications?status=UNKNOWN").expect(400);
  });

  it("combines Job scope with search/status/paging without expanding visibility", async () => {
    const response = await get("/api/jobs?scope=MY_PRIMARY&q=Node&status=PUBLISHED&sort=-title&limit=1");
    expect(response.status).toBe(200);
    expect(response.body.jobs.map((row) => row.id)).toEqual([job.id]);
    expect(response.body.pagination.total).toBe(1);
    expect((await get("/api/jobs?scope=COMPANY_PUBLISHED&status=CLOSED")).body.pagination.total).toBe(0);
    const managed = await get("/api/jobs/managed?q=Node&status=PUBLISHED&limit=1");
    expect(managed.status).toBe(200);
    expect(managed.body.managedJobs[0].job.id).toBe(job.id);
    expect(managed.body.pagination.total).toBe(1);
  });

  it("pages search-eligible CVs while retaining skill-only keyword and private-CV exclusion", async () => {
    const candidate = await createVerifiedUser();
    const category = await Category.create({ name: "Engineering", level: "FIELD" });
    for (const visibility of ["PUBLIC", "PUBLIC", "PRIVATE"]) {
      await CandidateCV.create({ candidateUserId: candidate.user._id, categoryId: category._id,
        name: "CV", sourceType: "GENERATED", status: "ACTIVE", visibility, generatedContent: { personalInfo: { fullName: "Candidate" } }, skillTags: ["Node.js"] });
    }
    const response = await get("/api/jobs/candidate-search/cvs?keyword=node&limit=1&page=2&sort=-updatedAt");
    expect(response.status).toBe(200);
    expect(response.body.cvs).toHaveLength(1);
    expect(response.body.pagination).toMatchObject({ total: 2, totalPages: 2 });
    await get("/api/jobs/candidate-search/cvs?q=Candidate").expect(400);
    expect((await get("/api/jobs/candidate-search/cvs?keyword=node")).body).not.toHaveProperty("pagination");
  });

  it("filters Invitation terminal state before paging and retains Primary-only management", async () => {
    const candidate = await createVerifiedUser({ fullName: "Alice" });
    const invitation = await JobInvitation.create({ candidateUserId: candidate.user._id, invitedCvId: new mongoose.Types.ObjectId(),
      jobId: job._id, sentByRecruiterCompanyMemberId: supporting.membership._id,
      invitedCvSnapshot: snapshot(), status: "PENDING", sentAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000) });
    await JobInvitation.updateOne({ _id: invitation._id }, { $set: { status: "REJECTED", rejectedAt: new Date() } });
    const response = await get(`/api/jobs/${job.id}/invitations?q=Alice&status=REJECTED&limit=1`);
    expect(response.status).toBe(200);
    expect(response.body.pagination.total).toBe(1);
    expect(response.body.invitations[0].status).toBe("REJECTED");
    await get(`/api/jobs/${job.id}/invitations?page=1`, await login(supporting)).expect(403);
  });

  it("filters recipient Notifications without changing read state or global unread count", async () => {
    for (const recipientUserId of [primary.user._id, primary.user._id, supporting.user._id]) {
      const { event } = await createNotificationEvent({ eventKey: String(new mongoose.Types.ObjectId()),
        type: "APPLICATION_UNASSIGNED", applicationId: new mongoose.Types.ObjectId(),
        recipients: [{ recipientUserId, content: "Assigned workload changed" }] });
      await materializeNotificationEvent({ eventId: event._id });
    }
    const response = await get("/api/notifications?type=APPLICATION_UNASSIGNED&readState=UNREAD&q=workload&limit=1");
    expect(response.status).toBe(200);
    expect(response.body.notifications).toHaveLength(1);
    expect(response.body.pagination.total).toBe(2);
    expect(response.body.unreadCount).toBe(2);
    expect((await get("/api/notifications?readState=READ")).body.pagination.total).toBe(0);
  });
});
