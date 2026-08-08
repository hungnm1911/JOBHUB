import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import COMPANY_APPROVAL_STATUS from "../../src/constants/company-approval-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import AuthToken from "../../src/models/auth-token.model.js";
import Company from "../../src/models/company.model.js";
import User from "../../src/models/user.model.js";
import {
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

const registerAndSubmitCompany = async (
  agent,
  {
    email,
    fullName = "Chris Manager",
    companyName,
    businessRegistrationNumber,
    description = "Submitted for review",
  },
) => {
  const registration = await agent
    .post("/api/auth/register/company-manager")
    .send({
      fullName,
      email,
      password: DEFAULT_PASSWORD,
    });

  expect(registration.status).toBe(201);

  const loginResponse = await agent.post("/api/auth/login").send({
    email,
    password: DEFAULT_PASSWORD,
  });

  expect(loginResponse.status).toBe(200);

  const accessToken = loginResponse.body.accessToken;

  const draftResponse = await agent
    .patch("/api/company")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      name: companyName,
      businessRegistrationNumber,
      description,
      website: "https://example.com",
    });

  expect(draftResponse.status).toBe(200);

  const submitResponse = await agent
    .post("/api/company/submit")
    .set("Authorization", `Bearer ${accessToken}`)
    .send();

  expect(submitResponse.status).toBe(200);

  return {
    company: submitResponse.body.company,
    manager: registration.body.user,
    onboardingAccessToken: accessToken,
  };
};

describe("POST /api/platform-admin/company-registrations/:companyId/reject", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("rejects a PENDING Company, persists reviewer metadata, keeps snapshot, and leaves CM PENDING_ACTIVATION without confirmation tokens", async () => {
    const agent = createTestAgent();

    const { user: admin } = await createVerifiedUser({
      email: "admin.reject@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });

    const submitted = await registerAndSubmitCompany(agent, {
      email: "manager.reject@example.com",
      fullName: "Reject Manager",
      companyName: "Reject Co",
      businessRegistrationNumber: "BRN-REJECT-1",
      description: "Immutable reject snapshot",
    });

    const snapshotBeforeReject = submitted.company.reviewSnapshot;
    const adminAccessToken = await loginAndGetAccessToken(agent, {
      email: "admin.reject@example.com",
    });

    const beforeReject = Date.now();

    const response = await agent
      .post(
        `/api/platform-admin/company-registrations/${submitted.company.id}/reject`,
      )
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/rejected/i);
    expect(response.body.companyRegistration).toMatchObject({
      id: submitted.company.id,
      approvalStatus: COMPANY_APPROVAL_STATUS.REJECTED,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
      reviewedByUserId: admin._id.toString(),
      activatedAt: null,
      manager: {
        id: submitted.manager.id,
        status: USER_STATUS.PENDING_ACTIVATION,
        role: USER_ROLE.COMPANY_STAFF,
      },
      reviewSnapshot: snapshotBeforeReject,
    });
    expect(
      new Date(response.body.companyRegistration.reviewedAt).getTime(),
    ).toBeGreaterThanOrEqual(beforeReject);

    const persistedCompany = await Company.findById(submitted.company.id);
    const persistedManager = await User.findById(submitted.manager.id);
    const authTokenCount = await AuthToken.countDocuments({
      userId: submitted.manager.id,
    });

    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.REJECTED,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(persistedCompany.reviewedByUserId.toString()).toBe(
      admin._id.toString(),
    );
    expect(persistedCompany.reviewedAt).not.toBeNull();
    expect(persistedCompany.activatedAt).toBeNull();
    expect(persistedCompany.reviewSnapshot.toObject()).toMatchObject(
      snapshotBeforeReject,
    );
    expect(persistedManager.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(authTokenCount).toBe(0);
  });

  it("rejects reject when Manager role or status is not COMPANY_STAFF PENDING_ACTIVATION and leaves Company/User unchanged", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "admin.reject.manager-state@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });

    const wrongStatus = await registerAndSubmitCompany(agent, {
      email: "manager.reject.wrong-status@example.com",
      companyName: "Wrong Status Reject Co",
      businessRegistrationNumber: "BRN-REJECT-WRONG-STATUS",
    });

    await User.updateOne(
      { _id: wrongStatus.manager.id },
      { status: USER_STATUS.ACTIVE },
    );

    const adminAccessToken = await loginAndGetAccessToken(agent, {
      email: "admin.reject.manager-state@example.com",
    });

    const wrongStatusResponse = await agent
      .post(
        `/api/platform-admin/company-registrations/${wrongStatus.company.id}/reject`,
      )
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send();

    expect(wrongStatusResponse.status).toBe(409);
    expect(wrongStatusResponse.body.error.message).toMatch(
      /PENDING_ACTIVATION/i,
    );

    const wrongStatusCompany = await Company.findById(wrongStatus.company.id);
    const wrongStatusManager = await User.findById(wrongStatus.manager.id);
    const wrongStatusTokenCount = await AuthToken.countDocuments({
      userId: wrongStatus.manager.id,
    });

    expect(wrongStatusCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.PENDING,
    );
    expect(wrongStatusCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(wrongStatusCompany.reviewedByUserId).toBeNull();
    expect(wrongStatusCompany.reviewedAt).toBeNull();
    expect(wrongStatusManager.status).toBe(USER_STATUS.ACTIVE);
    expect(wrongStatusManager.role).toBe(USER_ROLE.COMPANY_STAFF);
    expect(wrongStatusTokenCount).toBe(0);

    const wrongRole = await registerAndSubmitCompany(agent, {
      email: "manager.reject.wrong-role@example.com",
      companyName: "Wrong Role Reject Co",
      businessRegistrationNumber: "BRN-REJECT-WRONG-ROLE",
    });

    const wrongRoleManagerBefore = await User.findById(wrongRole.manager.id);
    await User.collection.updateOne(
      { _id: wrongRoleManagerBefore._id },
      { $set: { role: USER_ROLE.CANDIDATE } },
    );

    const wrongRoleResponse = await agent
      .post(
        `/api/platform-admin/company-registrations/${wrongRole.company.id}/reject`,
      )
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send();

    expect(wrongRoleResponse.status).toBe(409);
    expect(wrongRoleResponse.body.error.message).toMatch(/COMPANY_STAFF/i);

    const wrongRoleCompany = await Company.findById(wrongRole.company.id);
    const wrongRoleManager = await User.findById(wrongRole.manager.id);
    const wrongRoleTokenCount = await AuthToken.countDocuments({
      userId: wrongRole.manager.id,
    });

    expect(wrongRoleCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.PENDING,
    );
    expect(wrongRoleCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(wrongRoleCompany.reviewedByUserId).toBeNull();
    expect(wrongRoleCompany.reviewedAt).toBeNull();
    expect(wrongRoleManager.role).toBe(USER_ROLE.CANDIDATE);
    expect(wrongRoleManager.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(wrongRoleTokenCount).toBe(0);
  });

  it("rejects unauthorized actors and invalid source states", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "admin.reject.authz@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });
    await createVerifiedUser({
      email: "candidate.reject@example.com",
      role: USER_ROLE.CANDIDATE,
    });

    const draftRegistration = await agent
      .post("/api/auth/register/company-manager")
      .send({
        fullName: "Draft Manager",
        email: "manager.reject.draft@example.com",
        password: DEFAULT_PASSWORD,
      });

    expect(draftRegistration.status).toBe(201);

    const submitted = await registerAndSubmitCompany(agent, {
      email: "manager.reject.authz@example.com",
      companyName: "Authz Reject Co",
      businessRegistrationNumber: "BRN-REJECT-AUTHZ",
    });

    const candidateAccessToken = await loginAndGetAccessToken(agent, {
      email: "candidate.reject@example.com",
    });

    const candidateResponse = await agent
      .post(
        `/api/platform-admin/company-registrations/${submitted.company.id}/reject`,
      )
      .set("Authorization", `Bearer ${candidateAccessToken}`)
      .send();

    expect(candidateResponse.status).toBe(403);

    const onboardingResponse = await agent
      .post(
        `/api/platform-admin/company-registrations/${submitted.company.id}/reject`,
      )
      .set("Authorization", `Bearer ${submitted.onboardingAccessToken}`)
      .send();

    expect(onboardingResponse.status).toBe(403);

    const adminAccessToken = await loginAndGetAccessToken(agent, {
      email: "admin.reject.authz@example.com",
    });

    const unsubmittedResponse = await agent
      .post(
        `/api/platform-admin/company-registrations/${draftRegistration.body.company.id}/reject`,
      )
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send();

    expect(unsubmittedResponse.status).toBe(409);

    const unknownResponse = await agent
      .post("/api/platform-admin/company-registrations/not-a-valid-id/reject")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send();

    expect(unknownResponse.status).toBe(400);
  });

  it("treats reject as terminal: no second reject, no draft update, and no resubmit", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "admin.reject.terminal@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });

    const submitted = await registerAndSubmitCompany(agent, {
      email: "manager.reject.terminal@example.com",
      companyName: "Terminal Reject Co",
      businessRegistrationNumber: "BRN-REJECT-TERMINAL",
      description: "Must remain frozen",
    });

    const adminAccessToken = await loginAndGetAccessToken(agent, {
      email: "admin.reject.terminal@example.com",
    });

    const firstReject = await agent
      .post(
        `/api/platform-admin/company-registrations/${submitted.company.id}/reject`,
      )
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send();

    expect(firstReject.status).toBe(200);

    const secondReject = await agent
      .post(
        `/api/platform-admin/company-registrations/${submitted.company.id}/reject`,
      )
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send();

    expect(secondReject.status).toBe(409);

    const draftUpdate = await agent
      .patch("/api/company")
      .set("Authorization", `Bearer ${submitted.onboardingAccessToken}`)
      .send({
        name: "Must Not Change After Reject",
      });

    expect(draftUpdate.status).toBe(409);

    const resubmit = await agent
      .post("/api/company/submit")
      .set("Authorization", `Bearer ${submitted.onboardingAccessToken}`)
      .send();

    expect(resubmit.status).toBe(409);

    const persistedCompany = await Company.findById(submitted.company.id);

    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.REJECTED,
    );
    expect(persistedCompany.name).toBe("Terminal Reject Co");
    expect(persistedCompany.reviewSnapshot.name).toBe("Terminal Reject Co");
    expect(persistedCompany.reviewSnapshot.description).toBe(
      "Must remain frozen",
    );
  });
});
