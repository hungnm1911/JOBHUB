import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import AuthToken from "../../src/models/auth-token.model.js";
import Company from "../../src/models/company.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import User from "../../src/models/user.model.js";
import sendMail from "../../src/services/mail.service.js";
import { createActiveCompanyManagerContext, createActiveRecruiterContext, createCompanyStaffWithMembership,
  createPendingRecruiterWithActivationToken, createVerifiedUser, loginAndGetAccessToken } from "../helpers/auth-fixtures.js";
import { clearDatabase, connectTestDatabase, createTestAgent, disconnectTestDatabase } from "../helpers/database.js";

vi.mock("../../src/services/mail.service.js", () => ({ default: vi.fn().mockResolvedValue({}) }));
const bearer = { type: "bearer" };
const mailToken = () => decodeURIComponent(sendMail.mock.calls.at(-1)[0].text.match(/token=([^\s]+)/)[1]);
const setup = async () => {
  const agent = createTestAgent();
  const manager = await createActiveCompanyManagerContext();
  const token = await loginAndGetAccessToken(agent, { email: manager.user.email });
  return { agent, manager, token };
};

describe("V2/V3 API completion", () => {
  beforeAll(connectTestDatabase);
  afterEach(async () => { vi.clearAllMocks(); await clearDatabase(); });
  afterAll(disconnectTestDatabase);

  it("keeps current companies separate from submitted snapshots, combines filters/count/sort/pages", async () => {
    const { agent, manager, token: managerToken } = await setup();
    const draft = await createCompanyStaffWithMembership({ email: "draft@example.com", company: { name: "Z Draft" } });
    const { user: admin } = await createVerifiedUser({ email: "admin@example.com", role: "PLATFORM_ADMIN" });
    const token = await loginAndGetAccessToken(agent, { email: admin.email });
    const all = await agent.get("/api/platform-admin/companies?sort=name&limit=1").auth(token, bearer);
    expect(all.status).toBe(200);
    expect(all.body.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
    const filtered = await agent.get("/api/platform-admin/companies").auth(token, bearer)
      .query({ q: "Draft", approvalStatus: "NOT_SUBMITTED", operationalStatus: "INACTIVE", sort: "name", limit: 1 });
    expect(filtered.body.companies.map((c) => c.id)).toEqual([draft.company.id]);
    const registrations = await agent.get("/api/platform-admin/company-registrations").auth(token, bearer);
    expect(registrations.body.companyRegistrations.map((c) => c.id)).toEqual([manager.company.id]);
    await Company.updateOne({ _id: manager.company._id }, { name: "Current Name" });
    const detail = await agent.get(`/api/platform-admin/companies/${manager.company.id}`).auth(token, bearer);
    expect(detail.body.company.name).toBe("Current Name");
    expect(detail.body.manager.id).toBe(manager.user.id);
    const snapshot = await agent.get("/api/platform-admin/company-registrations").auth(token, bearer)
      .query({ q: "Active Manager", approvalStatus: "APPROVED", operationalStatus: "ACTIVE", sort: "name", page: 1, limit: 1 });
    expect(snapshot.status).toBe(200);
    expect(snapshot.body.companyRegistrations[0].companyName).toBe(manager.company.reviewSnapshot.name);
    expect(snapshot.body.pagination.total).toBe(1);
    const drafts = await agent.get("/api/platform-admin/company-registrations?approvalStatus=NOT_SUBMITTED").auth(token, bearer);
    expect(drafts.body.pagination.total).toBe(0);
    expect(JSON.stringify(detail.body)).not.toMatch(/passwordHash|tokenHash|refreshToken/);
    expect((await agent.get("/api/platform-admin/companies").auth(managerToken, bearer)).status).toBe(403);
    for (const path of ["/companies/invalid", "/companies?page=-1", "/companies?approvalStatus=UNKNOWN", "/company-registrations?limit=101"]) {
      expect((await agent.get(`/api/platform-admin${path}`).auth(token, bearer)).status).toBe(400);
    }
    expect((await agent.get("/api/platform-admin/companies/000000000000000000000000").auth(token, bearer)).status).toBe(404);
  });

  it("both recruiter lists combine search/user/membership filters before pagination and stable ties", async () => {
    const { agent, manager, token } = await setup();
    const a = await createActiveRecruiterContext({ company: manager.company, email: "a@example.com", employeeCode: "A", fullName: "Tie" });
    const b = await createActiveRecruiterContext({ company: manager.company, email: "b@example.com", employeeCode: "B", fullName: "Tie" });
    await createActiveRecruiterContext({ company: manager.company, email: "locked@example.com", employeeCode: "C", membershipStatus: "LOCKED" });
    const foreign = await createActiveRecruiterContext({ email: "foreign@example.com", fullName: "Tie" });
    const { user: admin } = await createVerifiedUser({ email: "admin@example.com", role: "PLATFORM_ADMIN" });
    const adminToken = await loginAndGetAccessToken(agent, { email: admin.email });
    for (const [path, auth] of [["/api/company/recruiters", token], [`/api/platform-admin/companies/${manager.company.id}/recruiters`, adminToken]]) {
      const query = { q: "Tie", membershipStatus: "ACTIVE", userStatus: "ACTIVE", sort: "fullName", limit: 1 };
      const page1 = await agent.get(path).auth(auth, bearer).query(query);
      const page2 = await agent.get(path).auth(auth, bearer).query({ ...query, page: 2 });
      expect(page1.status).toBe(200);
      expect(page1.body.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
      expect([page1.body.recruiters[0].id, page2.body.recruiters[0].id]).toEqual([a.user.id, b.user.id]);
      expect((await agent.get(path).auth(auth, bearer).query({ limit: 101 })).status).toBe(400);
    }
    expect((await agent.get(`/api/company/recruiters?companyId=${foreign.company.id}`).auth(token, bearer)).status).toBe(403);
    expect((await agent.get(`/api/platform-admin/companies/${manager.company.id}/recruiters`).auth(token, bearer)).status).toBe(403);
    expect((await agent.get("/api/platform-admin/companies/invalid/recruiters").auth(adminToken, bearer)).status).toBe(400);
    expect((await agent.get("/api/platform-admin/companies/000000000000000000000000/recruiters").auth(adminToken, bearer)).status).toBe(404);
  });

  it("PATCH only employee metadata; rejects duplicate atomically and never changes identity/lifecycle", async () => {
    const { agent, manager, token } = await setup();
    const target = await createActiveRecruiterContext({ company: manager.company });
    const peer = await createActiveRecruiterContext({ company: manager.company, email: "peer@example.com", employeeCode: "PEER" });
    const path = `/api/company/recruiters/${target.user.id}`;
    expect((await agent.patch(path).auth(token, bearer).send({ employeeCode: "PEER", jobTitle: "Lost" })).status).toBe(409);
    expect((await CompanyMember.findById(target.membership.id)).jobTitle).toBe("Recruiter");
    for (const field of ["fullName", "email", "role", "status", "membershipStatus", "userStatus"]) {
      expect((await agent.patch(path).auth(token, bearer).send({ [field]: "forbidden" })).status, field).toBe(400);
    }
    expect((await agent.patch(path).auth(token, bearer).send({ companyId: manager.company.id, jobTitle: "Denied" })).status).toBe(400);
    expect((await agent.patch(path).auth(token, bearer).send({ companyId: "foreign", jobTitle: "Denied" })).status).toBe(403);
    for (const body of [{}, { employeeCode: " " }, { jobTitle: null }, { jobTitle: "x".repeat(101) }]) {
      expect((await agent.patch(path).auth(token, bearer).send(body)).status).toBe(400);
    }
    const before = await User.findById(target.user.id).select("+passwordHash").lean();
    await CompanyMember.updateOne({ _id: target.membership.id }, { status: "LOCKED" });
    const updated = await agent.patch(path).auth(token, bearer).send({ employeeCode: " NEW ", jobTitle: " New Title " });
    expect(updated.status).toBe(200);
    expect(updated.body.recruiter.membership).toMatchObject({ employeeCode: "NEW", jobTitle: "New Title", status: "LOCKED" });
    expect(await User.findById(target.user.id).select("+passwordHash").lean()).toEqual(before);
    const peerToken = await loginAndGetAccessToken(agent, { email: peer.user.email });
    expect((await agent.patch(path).auth(peerToken, bearer).send({ jobTitle: "Denied" })).status).toBe(403);
    await CompanyMember.updateOne({ _id: target.membership.id }, { status: "TERMINATED" });
    expect((await agent.patch(path).auth(token, bearer).send({ jobTitle: "Denied" })).status).toBe(409);
    expect((await agent.put(path).auth(token, bearer).send({ jobTitle: "Denied" })).status).toBe(404);
    const foreign = await createActiveRecruiterContext({ email: "foreign@example.com" });
    expect((await agent.patch(`/api/company/recruiters/${foreign.user.id}`).auth(token, bearer).send({ jobTitle: "Denied" })).status).toBe(404);
    expect((await agent.patch("/api/company/recruiters/invalid").auth(token, bearer).send({ jobTitle: "Denied" })).status).toBe(400);
    expect((await agent.patch(`/api/company/recruiters/${new mongoose.Types.ObjectId()}`).auth(token, bearer).send({ jobTitle: "Denied" })).status).toBe(404);
  });

  it("concurrent PATCH keeps employee code unique and failed update does not partially write", async () => {
    const { agent, manager, token } = await setup();
    const a = await createActiveRecruiterContext({ company: manager.company });
    const b = await createActiveRecruiterContext({ company: manager.company, email: "other@example.com", employeeCode: "B" });
    const responses = await Promise.all([a, b].map((r) => agent.patch(`/api/company/recruiters/${r.user.id}`).auth(token, bearer).send({ employeeCode: "RACE", jobTitle: "Winner" })));
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await CompanyMember.countDocuments({ companyId: manager.company.id, employeeCode: "RACE" })).toBe(1);
    expect(await CompanyMember.countDocuments({ companyId: manager.company.id, jobTitle: "Recruiter" })).toBe(1);
  });

  it("resends activation only before activation, replaces old token, rejects expired/replay, hides credential", async () => {
    const { agent, manager, token } = await setup();
    const pending = await createPendingRecruiterWithActivationToken({ company: manager.company });
    const path = `/api/company/recruiters/${pending.user.id}/resend-activation`;
    const resent = await agent.post(path).auth(token, bearer);
    expect(resent.status).toBe(200);
    expect(JSON.stringify(resent.body)).not.toMatch(/token|password/i);
    const first = mailToken();
    expect((await agent.post("/api/auth/activate-recruiter").send({ token: pending.rawToken, password: "newpass123" })).status).toBe(400);
    await AuthToken.updateMany({ userId: pending.user.id }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await agent.post("/api/auth/activate-recruiter").send({ token: first, password: "newpass123" })).status).toBe(400);
    await agent.post(path).auth(token, bearer);
    const second = mailToken();
    expect((await agent.post("/api/auth/activate-recruiter").send({ token: second, password: "newpass123" })).status).toBe(200);
    expect((await agent.post("/api/auth/activate-recruiter").send({ token: second, password: "newpass123" })).status).toBe(400);
    expect((await agent.post(path).auth(token, bearer)).status).toBe(409);
    expect((await User.findById(pending.user.id)).status).toBe("ACTIVE");
    expect((await CompanyMember.findById(pending.membership.id)).status).toBe("ACTIVE");
  });

  it("activation resend handles mail failure, TERMINATED and cross-company without reset bypass", async () => {
    const { agent, manager, token } = await setup();
    const pending = await createPendingRecruiterWithActivationToken({ company: manager.company });
    const path = `/api/company/recruiters/${pending.user.id}/resend-activation`;
    sendMail.mockRejectedValueOnce(new Error("SMTP failed"));
    expect((await agent.post(path).auth(token, bearer)).status).toBe(503);
    expect(await AuthToken.countDocuments({ userId: pending.user.id })).toBe(0);
    expect((await User.findById(pending.user.id)).mustChangePassword).toBe(true);
    const forgot = await agent.post("/api/auth/forgot-password").send({ email: pending.user.email });
    expect(forgot.status).toBe(200);
    expect(await AuthToken.countDocuments({ userId: pending.user.id, type: "PASSWORD_RESET" })).toBe(0);
    await CompanyMember.updateOne({ _id: pending.membership.id }, { status: "TERMINATED" });
    expect((await agent.post(path).auth(token, bearer)).status).toBe(409);
    const foreign = await createPendingRecruiterWithActivationToken({ email: "foreign@example.com" });
    expect((await agent.post(`/api/company/recruiters/${foreign.user.id}/resend-activation`).auth(token, bearer)).status).toBe(404);
  });
});
