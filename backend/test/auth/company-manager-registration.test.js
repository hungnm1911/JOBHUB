import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import jsonwebtoken from "jsonwebtoken";

import config from "../../src/config/index.js";
import COMPANY_APPROVAL_STATUS from "../../src/constants/company-approval-status.js";
import COMPANY_MEMBER_ROLE from "../../src/constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import AuthSession from "../../src/models/auth-session.model.js";
import AuthToken from "../../src/models/auth-token.model.js";
import Company from "../../src/models/company.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import User from "../../src/models/user.model.js";
import { registerCompanyManager } from "../../src/services/auth.service.js";
import { hashAuthToken } from "../../src/utils/hash-auth-token.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

vi.mock("../../src/services/mail.service.js", () => ({
  default: vi.fn().mockResolvedValue({ messageId: "test-message-id" }),
}));

describe("POST /api/auth/register/company-manager", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("creates the onboarding aggregate and returns its initial limited session", async () => {
    const agent = createTestAgent();

    const response = await agent
      .post("/api/auth/register/company-manager")
      .send({
        fullName: "Chris Manager",
        email: "chris.manager@example.com",
        password: "password123",
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toMatch(/company manager registration/i);
    expect(response.body.user).toMatchObject({
      fullName: "Chris Manager",
      email: "chris.manager@example.com",
      role: USER_ROLE.COMPANY_STAFF,
      status: USER_STATUS.PENDING_ACTIVATION,
      emailVerifiedAt: null,
      mustChangePassword: false,
    });
    expect(response.body.user.id).toEqual(expect.any(String));
    expect(response.body.company).toMatchObject({
      managerUserId: response.body.user.id,
      name: null,
      approvalStatus: COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
      reviewSnapshot: null,
      submittedAt: null,
      reviewedByUserId: null,
      reviewedAt: null,
      activatedAt: null,
    });
    expect(response.body.company.id).toEqual(expect.any(String));
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
    expect(response.body.session).toMatchObject({
      id: expect.any(String),
      expiresAt: expect.any(String),
    });

    const persistedUser = await User.findOne({
      email: "chris.manager@example.com",
    }).select("+passwordHash");

    expect(persistedUser).not.toBeNull();
    expect(persistedUser.role).toBe(USER_ROLE.COMPANY_STAFF);
    expect(persistedUser.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(persistedUser.passwordHash).not.toBe("password123");

    const persistedMembership = await CompanyMember.findOne({
      userId: persistedUser._id,
      companyId: response.body.company.id,
      role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
      status: COMPANY_MEMBER_STATUS.ACTIVE,
    });

    expect(persistedMembership).not.toBeNull();

    const persistedCompany = await Company.findById(response.body.company.id);

    expect(persistedCompany).not.toBeNull();
    expect(persistedCompany.managerUserId).toBeUndefined();
    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(persistedCompany.reviewSnapshot).toBeNull();
    expect(persistedCompany.submittedAt).toBeNull();
    expect(persistedCompany.reviewedByUserId).toBeNull();
    expect(persistedCompany.reviewedAt).toBeNull();
    expect(persistedCompany.activatedAt).toBeNull();

    const persistedSession = await AuthSession.findById(
      response.body.session.id,
    ).select("+refreshTokenHash");

    expect(persistedSession).not.toBeNull();
    expect(persistedSession.userId.toString()).toBe(response.body.user.id);
    expect(persistedSession.refreshTokenHash).not.toBe(
      response.body.refreshToken,
    );
    expect(persistedSession.refreshTokenHash).toBe(
      hashAuthToken(response.body.refreshToken),
    );

    const decodedAccessToken = jsonwebtoken.verify(
      response.body.accessToken,
      config.jwt.secret,
      { algorithms: [config.jwt.algorithm] },
    );

    expect(decodedAccessToken).toMatchObject({
      userId: response.body.user.id,
      role: USER_ROLE.COMPANY_STAFF,
      sessionId: response.body.session.id,
    });

    const draftResponse = await agent
      .get("/api/company")
      .set("Authorization", `Bearer ${response.body.accessToken}`);

    expect(draftResponse.status).toBe(200);
    expect(draftResponse.body.company.id).toBe(response.body.company.id);

    const updateResponse = await agent
      .patch("/api/company")
      .set("Authorization", `Bearer ${response.body.accessToken}`)
      .send({
        name: "Registration Session Company",
        businessRegistrationNumber: "BRN-REGISTRATION-SESSION",
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.company).toMatchObject({
      id: response.body.company.id,
      name: "Registration Session Company",
      businessRegistrationNumber: "BRN-REGISTRATION-SESSION",
      approvalStatus: COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
    });

    const submitResponse = await agent
      .post("/api/company/submit")
      .set("Authorization", `Bearer ${response.body.accessToken}`)
      .send();

    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.company).toMatchObject({
      id: response.body.company.id,
      approvalStatus: COMPANY_APPROVAL_STATUS.PENDING,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
    });

    const authTokenCount = await AuthToken.countDocuments({
      userId: persistedUser._id,
    });

    expect(authTokenCount).toBe(0);

    const companyIndexes = await Company.collection.indexes();
    const companyIndexKeys = companyIndexes.map((index) =>
      Object.keys(index.key),
    );

    expect(companyIndexKeys).toEqual(
      expect.arrayContaining([["businessRegistrationNumber"], ["approvalStatus"]]),
    );
    expect(
      companyIndexes.find((index) => index.key.managerUserId === 1),
    ).toBeUndefined();

    const businessRegistrationNumberIndex = companyIndexes.find(
      (index) => index.key.businessRegistrationNumber === 1,
    );

    expect(businessRegistrationNumberIndex.unique).toBe(true);
    expect(businessRegistrationNumberIndex.partialFilterExpression).toEqual({
      businessRegistrationNumber: { $type: "string" },
    });

    const membershipIndexes = await CompanyMember.collection.indexes();
    const userIdIndex = membershipIndexes.find(
      (index) => index.key.userId === 1 && Object.keys(index.key).length === 1,
    );
    const managerCompanyIndex = membershipIndexes.find(
      (index) =>
        index.key.companyId === 1 &&
        Object.keys(index.key).length === 1 &&
        index.partialFilterExpression?.role ===
          COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
    );

    expect(userIdIndex?.unique).toBe(true);
    expect(managerCompanyIndex?.unique).toBe(true);
  });

  it("does not change Candidate registration lifecycle defaults", async () => {
    const agent = createTestAgent();

    const response = await agent.post("/api/auth/register/candidate").send({
      fullName: "Jane Candidate",
      email: "jane.candidate@example.com",
      password: "password123",
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      role: USER_ROLE.CANDIDATE,
      status: USER_STATUS.ACTIVE,
      emailVerifiedAt: null,
    });

    const companies = await Company.countDocuments();

    expect(companies).toBe(0);
  });

  it("rejects duplicate email registration", async () => {
    const agent = createTestAgent();
    const payload = {
      fullName: "Chris Manager",
      email: "duplicate.manager@example.com",
      password: "password123",
    };

    await agent.post("/api/auth/register/company-manager").send(payload);

    const response = await agent
      .post("/api/auth/register/company-manager")
      .send(payload);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe("Email is already registered");

    expect(await User.countDocuments()).toBe(1);
    expect(await Company.countDocuments()).toBe(1);
    expect(await CompanyMember.countDocuments()).toBe(1);
    expect(await AuthSession.countDocuments()).toBe(1);
  });

  it("rejects client-supplied role selection", async () => {
    const agent = createTestAgent();

    const response = await agent
      .post("/api/auth/register/company-manager")
      .send({
        fullName: "Chris Manager",
        email: "role-hijack.manager@example.com",
        password: "password123",
        role: USER_ROLE.PLATFORM_ADMIN,
      });

    expect(response.status).toBe(400);
    expect(await User.findOne({ email: "role-hijack.manager@example.com" }))
      .toBeNull();
    expect(await Company.countDocuments()).toBe(0);
  });

  it("rolls back TX-01 when Company persistence fails", async () => {
    const createSpy = vi
      .spyOn(Company, "create")
      .mockRejectedValueOnce(new Error("forced company persistence failure"));

    await expect(
      registerCompanyManager({
        fullName: "Rollback Manager",
        email: "rollback.manager@example.com",
        password: "password123",
      }),
    ).rejects.toThrow("forced company persistence failure");

    expect(createSpy).toHaveBeenCalledOnce();
    expect(
      await User.findOne({ email: "rollback.manager@example.com" }),
    ).toBeNull();
    expect(await Company.countDocuments()).toBe(0);
    expect(await CompanyMember.countDocuments()).toBe(0);
    expect(await AuthSession.countDocuments()).toBe(0);
  });

  it("rolls back TX-01 when initial session persistence fails", async () => {
    const createSpy = vi
      .spyOn(AuthSession, "create")
      .mockRejectedValueOnce(new Error("forced session persistence failure"));

    await expect(
      registerCompanyManager({
        fullName: "Session Rollback Manager",
        email: "session.rollback.manager@example.com",
        password: "password123",
      }),
    ).rejects.toThrow("forced session persistence failure");

    expect(createSpy).toHaveBeenCalledOnce();
    expect(
      await User.findOne({ email: "session.rollback.manager@example.com" }),
    ).toBeNull();
    expect(await Company.countDocuments()).toBe(0);
    expect(await CompanyMember.countDocuments()).toBe(0);
    expect(await AuthSession.countDocuments()).toBe(0);
  });
});
