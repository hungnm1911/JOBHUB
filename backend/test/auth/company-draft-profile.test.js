import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import mongoose from "mongoose";

import COMPANY_APPROVAL_STATUS from "../../src/constants/company-approval-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Company from "../../src/models/company.model.js";
import User from "../../src/models/user.model.js";
import {
  createVerifiedUser,
  DEFAULT_PASSWORD,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

vi.mock("../../src/services/mail.service.js", () => ({
  default: vi.fn().mockResolvedValue({ messageId: "test-message-id" }),
}));

const registerCompanyManager = async (agent, {
  email,
  fullName = "Chris Manager",
  password = DEFAULT_PASSWORD,
}) => {
  const response = await agent.post("/api/auth/register/company-manager").send({
    fullName,
    email,
    password,
  });

  expect(response.status).toBe(201);

  return response.body;
};

const loginAs = async (agent, { email, password = DEFAULT_PASSWORD }) => {
  const response = await agent.post("/api/auth/login").send({
    email,
    password,
  });

  expect(response.status).toBe(200);

  return response.body;
};

const forceCompanyPendingReview = async (company) => {
  company.name = company.name ?? "Pending Company";
  company.businessRegistrationNumber =
    company.businessRegistrationNumber ?? "BRN-PENDING-1";
  company.approvalStatus = COMPANY_APPROVAL_STATUS.PENDING;
  company.operationalStatus = COMPANY_OPERATIONAL_STATUS.INACTIVE;
  company.submittedAt = new Date();
  company.reviewSnapshot = {
    name: company.name,
    logoUrl: null,
    bannerUrl: null,
    website: null,
    address: null,
    description: null,
    contactInfo: null,
    businessRegistrationNumber: company.businessRegistrationNumber,
  };
  company.reviewedByUserId = null;
  company.reviewedAt = null;
  company.activatedAt = null;

  await company.save();
};

describe("Company draft profile and tenant ownership (F02)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("issues a limited onboarding login for PENDING_ACTIVATION Company Manager without activating the account", async () => {
    const agent = createTestAgent();

    await registerCompanyManager(agent, {
      email: "onboarding.login@example.com",
    });

    const loginResponse = await loginAs(agent, {
      email: "onboarding.login@example.com",
    });

    expect(loginResponse.user).toMatchObject({
      role: USER_ROLE.COMPANY_MANAGER,
      status: USER_STATUS.PENDING_ACTIVATION,
      emailVerifiedAt: null,
    });
    expect(loginResponse.accessToken).toEqual(expect.any(String));

    const persistedUser = await User.findOne({
      email: "onboarding.login@example.com",
    });

    expect(persistedUser.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(persistedUser.emailVerifiedAt).toBeNull();

    const activeProtected = await agent
      .get("/api/auth-access-probe/protected")
      .set("Authorization", `Bearer ${loginResponse.accessToken}`);

    expect(activeProtected.status).toBe(403);
    expect(activeProtected.body.error.message).toMatch(/not active/i);
  });

  it("lets the authenticated Company Manager get and update their own draft Company", async () => {
    const agent = createTestAgent();

    const registration = await registerCompanyManager(agent, {
      email: "draft.owner@example.com",
    });
    const loginResponse = await loginAs(agent, {
      email: "draft.owner@example.com",
    });

    const getResponse = await agent
      .get("/api/company")
      .set("Authorization", `Bearer ${loginResponse.accessToken}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.company).toMatchObject({
      id: registration.company.id,
      managerUserId: registration.user.id,
      approvalStatus: COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
      name: null,
    });

    const patchResponse = await agent
      .patch("/api/company")
      .set("Authorization", `Bearer ${loginResponse.accessToken}`)
      .send({
        name: "Acme Draft",
        website: "https://acme.example",
        businessRegistrationNumber: "BRN-ACME-1",
        description: "Draft company profile",
      });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.company).toMatchObject({
      id: registration.company.id,
      managerUserId: registration.user.id,
      name: "Acme Draft",
      website: "https://acme.example",
      businessRegistrationNumber: "BRN-ACME-1",
      description: "Draft company profile",
      approvalStatus: COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
      reviewSnapshot: null,
      submittedAt: null,
    });

    const persistedCompany = await Company.findById(registration.company.id);

    expect(persistedCompany.name).toBe("Acme Draft");
    expect(persistedCompany.managerUserId.toString()).toBe(
      registration.user.id,
    );
    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
    );
  });

  it("resolves ownership from the authenticated manager and ignores client-supplied company identifiers", async () => {
    const agent = createTestAgent();

    const firstRegistration = await registerCompanyManager(agent, {
      email: "tenant.a@example.com",
      fullName: "Manager A",
    });
    const secondRegistration = await registerCompanyManager(agent, {
      email: "tenant.b@example.com",
      fullName: "Manager B",
    });

    const firstLogin = await loginAs(agent, {
      email: "tenant.a@example.com",
    });
    const secondLogin = await loginAs(agent, {
      email: "tenant.b@example.com",
    });

    const rejectedClientCompanyId = await agent
      .patch("/api/company")
      .set("Authorization", `Bearer ${firstLogin.accessToken}`)
      .send({
        companyId: secondRegistration.company.id,
        name: "Should Not Cross Tenant",
      });

    expect(rejectedClientCompanyId.status).toBe(400);

    const firstPatch = await agent
      .patch("/api/company")
      .set("Authorization", `Bearer ${firstLogin.accessToken}`)
      .send({
        name: "Tenant A Company",
      });

    expect(firstPatch.status).toBe(200);
    expect(firstPatch.body.company.id).toBe(firstRegistration.company.id);
    expect(firstPatch.body.company.name).toBe("Tenant A Company");

    const secondGet = await agent
      .get("/api/company")
      .set("Authorization", `Bearer ${secondLogin.accessToken}`);

    expect(secondGet.status).toBe(200);
    expect(secondGet.body.company.id).toBe(secondRegistration.company.id);
    expect(secondGet.body.company.name).toBeNull();

    const firstCompany = await Company.findById(firstRegistration.company.id);
    const secondCompany = await Company.findById(secondRegistration.company.id);

    expect(firstCompany.name).toBe("Tenant A Company");
    expect(secondCompany.name).toBeNull();
  });

  it("rejects onboarding GET when Company is outside F02 NOT_SUBMITTED + INACTIVE boundary", async () => {
    const agent = createTestAgent();

    const registration = await registerCompanyManager(agent, {
      email: "onboarding.get.lifecycle@example.com",
    });
    const loginResponse = await loginAs(agent, {
      email: "onboarding.get.lifecycle@example.com",
    });

    const draftGet = await agent
      .get("/api/company")
      .set("Authorization", `Bearer ${loginResponse.accessToken}`);

    expect(draftGet.status).toBe(200);
    expect(draftGet.body.company.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
    );
    expect(draftGet.body.company.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );

    const company = await Company.findById(registration.company.id);
    await forceCompanyPendingReview(company);

    const pendingGet = await agent
      .get("/api/company")
      .set("Authorization", `Bearer ${loginResponse.accessToken}`);

    expect(pendingGet.status).toBe(409);
    expect(pendingGet.body.error.message).toMatch(/NOT_SUBMITTED and INACTIVE/i);

    company.approvalStatus = COMPANY_APPROVAL_STATUS.REJECTED;
    company.reviewedByUserId = new mongoose.Types.ObjectId();
    company.reviewedAt = new Date();
    await company.save();

    const rejectedGet = await agent
      .get("/api/company")
      .set("Authorization", `Bearer ${loginResponse.accessToken}`);

    expect(rejectedGet.status).toBe(409);
    expect(rejectedGet.body.error.message).toMatch(/NOT_SUBMITTED and INACTIVE/i);

    company.approvalStatus = COMPANY_APPROVAL_STATUS.APPROVED;
    company.operationalStatus = COMPANY_OPERATIONAL_STATUS.INACTIVE;
    await company.save();

    const approvedInactiveGet = await agent
      .get("/api/company")
      .set("Authorization", `Bearer ${loginResponse.accessToken}`);

    expect(approvedInactiveGet.status).toBe(409);
    expect(approvedInactiveGet.body.error.message).toMatch(
      /NOT_SUBMITTED and INACTIVE/i,
    );

    const persistedCompany = await Company.findById(registration.company.id);
    const persistedManager = await User.findById(registration.user.id);

    expect(persistedCompany.approvalStatus).toBe(COMPANY_APPROVAL_STATUS.APPROVED);
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(persistedManager.status).toBe(USER_STATUS.PENDING_ACTIVATION);
  });

  it("rejects draft updates when Company is no longer NOT_SUBMITTED + INACTIVE", async () => {
    const agent = createTestAgent();

    const registration = await registerCompanyManager(agent, {
      email: "frozen.draft@example.com",
    });
    const loginResponse = await loginAs(agent, {
      email: "frozen.draft@example.com",
    });

    const company = await Company.findById(registration.company.id);
    await forceCompanyPendingReview(company);

    const response = await agent
      .patch("/api/company")
      .set("Authorization", `Bearer ${loginResponse.accessToken}`)
      .send({
        name: "Must Not Update",
      });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/NOT_SUBMITTED and INACTIVE/i);

    const persistedCompany = await Company.findById(registration.company.id);

    expect(persistedCompany.name).toBe("Pending Company");
    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.PENDING,
    );
  });

  it("rejects non-Company-Manager active-account access tokens from Company self-service routes", async () => {
    const agent = createTestAgent();

    const { password } = await createVerifiedUser({
      email: "active.candidate@example.com",
      fullName: "Active Candidate",
    });

    const loginResponse = await loginAs(agent, {
      email: "active.candidate@example.com",
      password,
    });

    const response = await agent
      .get("/api/company")
      .set("Authorization", `Bearer ${loginResponse.accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/Company Manager access required/i);
  });
});
