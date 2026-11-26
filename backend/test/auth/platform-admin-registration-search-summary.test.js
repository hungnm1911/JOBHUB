import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import Company from "../../src/models/company.model.js";
import User from "../../src/models/user.model.js";
import {
  createActiveRecruiterContext,
  createCompanyStaffWithMembership,
  createVerifiedUser,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import { clearDatabase, connectTestDatabase, createTestAgent, disconnectTestDatabase } from "../helpers/database.js";

const ROOT = "/api/platform-admin/company-registrations";
const bearer = { type: "bearer" };
const emptySummary = { total: 0, pending: 0, awaitingConfirmation: 0, active: 0, rejected: 0, locked: 0 };
const setup = async () => {
  const agent = createTestAgent();
  const { user: admin } = await createVerifiedUser({ role: "PLATFORM_ADMIN", email: "reviewer@example.com" });
  const token = await loginAndGetAccessToken(agent, { email: admin.email });
  return { agent, admin, token };
};

const registration = async (admin, index, {
  approvalStatus = "PENDING", operationalStatus = "INACTIVE",
  fullName = `Manager ${index}`, email = `manager.${index}@example.com`,
  snapshotName = `Snapshot ${index}`, currentName = snapshotName,
} = {}) => {
  const reviewed = approvalStatus !== "PENDING";
  const activated = operationalStatus === "ACTIVE" || operationalStatus === "LOCKED";
  const businessRegistrationNumber = `SEARCH-SUMMARY-${index}`;
  return createCompanyStaffWithMembership({
    email, fullName,
    status: operationalStatus === "LOCKED" ? "TERMINATED" : activated ? "ACTIVE" : "PENDING_ACTIVATION",
    emailVerifiedAt: activated ? new Date("2026-01-03") : null,
    company: {
      name: currentName, businessRegistrationNumber, approvalStatus, operationalStatus,
      submittedAt: new Date("2026-01-01"),
      reviewSnapshot: { name: snapshotName, businessRegistrationNumber },
      reviewedByUserId: reviewed ? admin._id : null,
      reviewedAt: reviewed ? new Date("2026-01-02") : null,
      activatedAt: activated ? new Date("2026-01-03") : null,
    },
  });
};

describe("Admin registration search and summary (phases 2–3)", () => {
  beforeAll(connectTestDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);

  it("searches current Manager name/email through membership before filtered count, sort and pagination", async () => {
    const { agent, admin, token } = await setup();
    const a = await registration(admin, 1, { fullName: "Find Manager", snapshotName: "Tie" });
    const b = await registration(admin, 2, { fullName: "Find Manager", snapshotName: "Tie" });
    await registration(admin, 3, { fullName: "Find Manager", approvalStatus: "REJECTED" });
    await registration(admin, 4, { fullName: "Other Manager" });
    const query = { q: "  FIND MANAGER  ", approvalStatus: "PENDING", operationalStatus: "INACTIVE", sort: "name", limit: 1 };
    const page1 = await agent.get(ROOT).auth(token, bearer).query(query);
    const page2 = await agent.get(ROOT).auth(token, bearer).query({ ...query, page: 2 });
    expect(page1.status).toBe(200);
    expect(page1.body.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect([page1.body.companyRegistrations[0].id, page2.body.companyRegistrations[0].id])
      .toEqual([a.company.id, b.company.id]);
    const email = await agent.get(ROOT).auth(token, bearer).query({ q: "MANAGER.2@EXAMPLE.COM" });
    expect(email.body.companyRegistrations.map((item) => item.id)).toEqual([b.company.id]);
    const beyond = await agent.get(ROOT).auth(token, bearer).query({ ...query, page: 3 });
    expect(beyond.body.companyRegistrations).toEqual([]);
    expect(beyond.body.pagination.total).toBe(2);
    const notSubmitted = await agent.get(ROOT).auth(token, bearer)
      .query({ q: "Find Manager", approvalStatus: "NOT_SUBMITTED" });
    expect(notSubmitted.body.pagination.total).toBe(0);
  });

  it("ORs literal snapshot/Manager matches once; excludes Recruiter, draft and current Company-name matches", async () => {
    const { agent, admin, token } = await setup();
    const target = await registration(admin, 1, {
      approvalStatus: "APPROVED", operationalStatus: "ACTIVE",
      fullName: "Literal [a+b]", snapshotName: "Literal [a+b]", currentName: "Current Name Only",
    });
    await registration(admin, 2, { fullName: "Unrelated", snapshotName: "Unrelated" });
    await createCompanyStaffWithMembership({ email: "draft@example.com", fullName: "Literal [a+b]" });
    await createActiveRecruiterContext({ company: target.company, fullName: "Recruiter Only", email: "recruiter.only@example.com" });
    const before = await Company.findById(target.company.id).lean();
    const matched = await agent.get(ROOT).auth(token, bearer).query({ q: "[a+b]" });
    expect(matched.status).toBe(200);
    expect(matched.body.pagination.total).toBe(1);
    expect(matched.body.companyRegistrations.map((item) => item.id)).toEqual([target.company.id]);
    for (const q of ["Recruiter Only", "recruiter.only@example.com", "Current Name Only", ".*"]) {
      const response = await agent.get(ROOT).auth(token, bearer).query({ q });
      expect(response.body.pagination.total, q).toBe(0);
    }
    const brn = await agent.get(ROOT).auth(token, bearer).query({ q: "SEARCH-SUMMARY-1" });
    expect(brn.body.pagination.total).toBe(1);
    await User.updateOne({ _id: target.user.id }, { fullName: "Renamed Manager", email: "renamed@example.com" });
    const renamed = await agent.get(ROOT).auth(token, bearer).query({ q: "renamed@example.com" });
    expect(renamed.body.companyRegistrations.map((item) => item.id)).toEqual([target.company.id]);
    expect(await Company.findById(target.company.id).lean()).toEqual(before);
  });

  it("returns all zero counts on an empty database and routes summary separately from Company detail", async () => {
    const { agent, token } = await setup();
    const response = await agent.get(`${ROOT}/summary`).auth(token, bearer);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ summary: emptySummary });
    expect((await agent.get(`${ROOT}/invalid`).auth(token, bearer)).status).toBe(400);
  });

  it("counts the entire submitted dataset across all five states, including LOCKED and excluding drafts", async () => {
    const { agent, admin, token } = await setup();
    await Promise.all(Array.from({ length: 21 }, (_, index) => registration(admin, index)));
    await registration(admin, 21, { approvalStatus: "APPROVED" });
    await registration(admin, 22, { approvalStatus: "APPROVED", operationalStatus: "ACTIVE" });
    await registration(admin, 23, { approvalStatus: "REJECTED" });
    await registration(admin, 24, { approvalStatus: "APPROVED", operationalStatus: "LOCKED" });
    await createCompanyStaffWithMembership({ email: "draft@example.com" });
    const before = await Company.find().sort({ _id: 1 }).lean();
    const list = await agent.get(ROOT).auth(token, bearer);
    expect(list.body.companyRegistrations).toHaveLength(20);
    const response = await agent.get(`${ROOT}/summary`).auth(token, bearer);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ summary: {
      total: 25, pending: 21, awaitingConfirmation: 1, active: 1, rejected: 1, locked: 1,
    } });
    expect(response.body.summary.total).toBe(list.body.pagination.total);
    expect(JSON.stringify(response.body)).not.toMatch(/email|password|manager|snapshot|token/i);
    expect(await Company.find().sort({ _id: 1 }).lean()).toEqual(before);
  });

  it("recounts current lifecycle state without persisting counters or changing snapshots", async () => {
    const { agent, admin, token } = await setup();
    const target = await registration(admin, 1);
    await agent.get(`${ROOT}/summary`).auth(token, bearer);
    const rejected = await agent.post(`${ROOT}/${target.company.id}/reject`).auth(token, bearer);
    expect(rejected.status).toBe(200);
    const response = await agent.get(`${ROOT}/summary`).auth(token, bearer);
    expect(response.body.summary).toEqual({ ...emptySummary, total: 1, rejected: 1 });
    expect((await Company.findById(target.company.id)).reviewSnapshot.toObject())
      .toEqual(target.company.reviewSnapshot.toObject());
  });

  it("enforces normal ACTIVE Admin access for search and summary", async () => {
    const { agent, admin, token } = await setup();
    const manager = await registration(admin, 1, { approvalStatus: "APPROVED", operationalStatus: "ACTIVE" });
    const recruiter = await createActiveRecruiterContext({ company: manager.company });
    const { user: candidate } = await createVerifiedUser({ email: "candidate@example.com" });
    for (const path of [`${ROOT}?q=Manager`, `${ROOT}/summary`]) {
      expect((await agent.get(path)).status).toBe(401);
      expect((await agent.get(path).auth(token, bearer)).status).toBe(200);
      for (const user of [manager.user, recruiter.user, candidate]) {
        const otherToken = await loginAndGetAccessToken(agent, { email: user.email });
        expect((await agent.get(path).auth(otherToken, bearer)).status).toBe(403);
      }
    }
    await User.updateOne({ _id: admin.id }, { status: "LOCKED" });
    expect((await agent.get(`${ROOT}/summary`).auth(token, bearer)).status).toBe(403);
  });

  it("strictly rejects summary queries and retains list search validation", async () => {
    const { agent, token } = await setup();
    for (const query of [{ q: "Manager" }, { page: "1" }, { limit: "1" }, { approvalStatus: "PENDING" }, { companyId: "invalid" }, { q: ["a", "b"] }, { "": "value" }]) {
      const response = await agent.get(`${ROOT}/summary`).auth(token, bearer).query(query);
      expect(response.status, JSON.stringify(query)).toBe(400);
      expect(response.body.error.details.field).toBe(Object.keys(query)[0]);
    }
    for (const q of [" ", "x".repeat(201), ["a", "b"]]) {
      expect((await agent.get(ROOT).auth(token, bearer).query({ q })).status).toBe(400);
    }
  });
});
