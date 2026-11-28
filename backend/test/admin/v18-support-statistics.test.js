import { beforeAll, afterAll, afterEach, describe, it, expect } from "vitest";
import {
  connectTestDatabase,
  disconnectTestDatabase,
  clearDatabase,
  createTestAgent,
} from "../helpers/database.js";
import {
  createVerifiedUser,
  createApprovedActiveCompanyFields,
  createCompanyStaffWithMembership,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import SupportConversation from "../../src/models/support-conversation.model.js";
import SupportMessage from "../../src/models/support-message.model.js";
import Notification from "../../src/models/notification.model.js";
import Company from "../../src/models/company.model.js";
import User from "../../src/models/user.model.js";
import { getPlatformStatistics } from "../../src/services/platform-admin.service.js";
import { sendSupportMessage } from "../../src/services/support.service.js";

const setup = async () => {
  const agent = createTestAgent();
  const admin = await createVerifiedUser({
    email: "support-admin@test.com",
    role: "PLATFORM_ADMIN",
  });
  const manager = await createCompanyStaffWithMembership({
    email: "support-manager@test.com",
    status: "ACTIVE",
    emailVerifiedAt: new Date(),
    company: createApprovedActiveCompanyFields({
      name: "Acme",
      businessRegistrationNumber: "9876543210",
      reviewedByUserId: admin.user._id,
    }),
  });
  const token = await loginAndGetAccessToken(agent, {
    email: admin.user.email,
    password: admin.password,
  });
  const managerToken = await loginAndGetAccessToken(agent, {
    email: manager.user.email,
    password: manager.password,
  });
  return { agent, admin, manager, token, managerToken };
};
describe("V18 Company support and statistics", () => {
  beforeAll(async () => {
    await connectTestDatabase();
    await Promise.all([SupportConversation.init(), SupportMessage.init()]);
  });
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);
  it("supports both actors, one conversation, actual sender and idempotent sends/notifications", async () => {
    const { agent, manager, admin, token, managerToken } = await setup();
    const path = `/api/platform-admin/companies/${manager.company.id}/support/messages`;
    const empty = await agent.get(path).set("Authorization", `Bearer ${token}`);
    expect(empty.body.conversation).toBeNull();
    const send = () =>
      agent
        .post(path)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Xin chào", clientRequestId: "a-1" });
    const first = await send();
    expect(first.status).toBe(200);
    expect(first.body.message).toMatchObject({
      senderUserId: admin.user.id,
      senderRole: "PLATFORM_ADMIN",
      content: "Xin chào",
    });
    expect((await send()).body.message.id).toBe(first.body.message.id);
    const reply = await agent
      .post("/api/company/support/messages")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ content: "Tôi cần hỗ trợ", clientRequestId: "m-1" });
    expect(reply.status).toBe(200);
    expect(reply.body.message.senderRole).toBe("COMPANY_MANAGER");
    expect(reply.body.conversation.id).toBe(first.body.conversation.id);
    expect(await SupportConversation.countDocuments()).toBe(1);
    expect(await SupportMessage.countDocuments()).toBe(2);
    expect(
      await Notification.countDocuments({
        recipientUserId: admin.user._id,
        type: "SUPPORT_MESSAGE_CREATED",
      }),
    ).toBe(1);
    expect(
      await Notification.countDocuments({
        recipientUserId: manager.user._id,
        type: "SUPPORT_MESSAGE_CREATED",
      }),
    ).toBe(1);
    expect(
      (
        await agent
          .get(`${path}?page=1&limit=1&q=hỗ`)
          .set("Authorization", `Bearer ${token}`)
      ).body.pagination.total,
    ).toBe(1);
    expect(
      (
        await agent
          .post(path)
          .set("Authorization", `Bearer ${token}`)
          .send({ content: "Khác", clientRequestId: "a-1" })
      ).status,
    ).toBe(409);
  });
  it("denies foreign Managers/Recruiters/Candidates and forged actor/tenant fields", async () => {
    const { agent, admin, manager, managerToken, token } = await setup();
    const other = await createCompanyStaffWithMembership({
      email: "foreign@test.com",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      company: createApprovedActiveCompanyFields({
        name: "Other",
        businessRegistrationNumber: "1236547890",
        reviewedByUserId: admin.user._id,
      }),
    });
    const foreignToken = await loginAndGetAccessToken(agent, {
      email: other.user.email,
      password: other.password,
    });
    expect(
      (
        await agent
          .get(
            `/api/platform-admin/companies/${manager.company.id}/support/messages`,
          )
          .set("Authorization", `Bearer ${foreignToken}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await agent
          .get(`/api/company/support/messages?companyId=${manager.company.id}`)
          .set("Authorization", `Bearer ${foreignToken}`)
      ).status,
    ).toBe(400);
    expect(
      (
        await agent
          .post("/api/company/support/messages")
          .set("Authorization", `Bearer ${managerToken}`)
          .send({
            content: "Hi",
            clientRequestId: "x",
            senderUserId: other.user.id,
          })
      ).status,
    ).toBe(400);
    const candidate = await createVerifiedUser({
      email: "candidate-support@test.com",
    });
    const candidateToken = await loginAndGetAccessToken(agent, {
      email: candidate.user.email,
      password: candidate.password,
    });
    expect(
      (
        await agent
          .get("/api/company/support/messages")
          .set("Authorization", `Bearer ${candidateToken}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await agent
          .get("/api/platform-admin/statistics")
          .set("Authorization", `Bearer ${candidateToken}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await agent
          .get("/api/platform-admin/statistics?from=2020")
          .set("Authorization", `Bearer ${token}`)
      ).status,
    ).toBe(400);
  });
  it("serializes concurrent sends, preserves guard timestamps and freezes sending after Company lock", async () => {
    const { admin, manager, agent, token, managerToken } = await setup();
    const beforeUser = await User.findById(admin.user._id);
    const beforeCompany = await Company.findById(manager.company._id);
    const send = () =>
      sendSupportMessage({
        userId: admin.user._id,
        companyId: manager.company._id,
        content: "Concurrent",
        clientRequestId: "race",
      });
    const results = await Promise.all([send(), send()]);
    expect(results[0].message.id).toBe(results[1].message.id);
    expect(await SupportMessage.countDocuments()).toBe(1);
    expect((await User.findById(admin.user._id)).updatedAt).toEqual(
      beforeUser.updatedAt,
    );
    expect((await Company.findById(manager.company._id)).updatedAt).toEqual(
      beforeCompany.updatedAt,
    );
    await Company.updateOne(
      { _id: manager.company._id },
      { $set: { operationalStatus: "LOCKED" } },
    );
    const path = `/api/platform-admin/companies/${manager.company.id}/support/messages`;
    expect(
      (await agent.get(path).set("Authorization", `Bearer ${token}`)).status,
    ).toBe(200);
    expect(
      (
        await agent
          .post(path)
          .set("Authorization", `Bearer ${token}`)
          .send({ content: "No", clientRequestId: "locked" })
      ).status,
    ).toBe(409);
    expect(
      (
        await agent
          .get("/api/company/support/messages")
          .set("Authorization", `Bearer ${managerToken}`)
      ).status,
    ).toBe(403);
  });
  it("returns zero-filled canonical breakdowns and resolves Manager actorType independently of raw role", async () => {
    const empty = await getPlatformStatistics();
    expect(empty.users.total).toBe(0);
    expect(empty.jobs.byStatus).toMatchObject({
      DRAFT: 0,
      PUBLISHED: 0,
      CLOSED: 0,
    });
    const { agent, token } = await setup();
    const response = await agent
      .get("/api/platform-admin/statistics")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.statistics.users).toMatchObject({
      total: 2,
      byActorType: {
        PLATFORM_ADMIN: 1,
        COMPANY_MANAGER: 1,
        RECRUITER: 0,
        UNRESOLVED: 0,
      },
    });
    expect(response.body.statistics.companies.total).toBe(1);
    expect(response.body.statistics.applications.total).toBe(0);
  });
});
