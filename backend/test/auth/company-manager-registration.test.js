import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import COMPANY_APPROVAL_STATUS from "../../src/constants/company-approval-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import AuthToken from "../../src/models/auth-token.model.js";
import Company from "../../src/models/company.model.js";
import User from "../../src/models/user.model.js";
import { registerCompanyManager } from "../../src/services/auth.service.js";
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

  it("creates a pending Company Manager and linked NOT_SUBMITTED Company in one onboarding", async () => {
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
      role: USER_ROLE.COMPANY_MANAGER,
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
    expect(response.body.accessToken).toBeUndefined();
    expect(response.body.refreshToken).toBeUndefined();

    const persistedUser = await User.findOne({
      email: "chris.manager@example.com",
    }).select("+passwordHash");

    expect(persistedUser).not.toBeNull();
    expect(persistedUser.role).toBe(USER_ROLE.COMPANY_MANAGER);
    expect(persistedUser.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(persistedUser.passwordHash).not.toBe("password123");

    const persistedCompany = await Company.findOne({
      managerUserId: persistedUser._id,
    });

    expect(persistedCompany).not.toBeNull();
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

    const authTokenCount = await AuthToken.countDocuments({
      userId: persistedUser._id,
    });

    expect(authTokenCount).toBe(0);

    const companyIndexes = await Company.collection.indexes();
    const indexKeys = companyIndexes.map((index) => Object.keys(index.key));

    expect(indexKeys).toEqual(
      expect.arrayContaining([
        ["managerUserId"],
        ["businessRegistrationNumber"],
        ["approvalStatus"],
      ]),
    );

    const managerUserIdIndex = companyIndexes.find(
      (index) => index.key.managerUserId === 1,
    );
    const businessRegistrationNumberIndex = companyIndexes.find(
      (index) => index.key.businessRegistrationNumber === 1,
    );

    expect(managerUserIdIndex.unique).toBe(true);
    expect(businessRegistrationNumberIndex.unique).toBe(true);
    expect(businessRegistrationNumberIndex.partialFilterExpression).toEqual({
      businessRegistrationNumber: { $type: "string" },
    });
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
  });
});
