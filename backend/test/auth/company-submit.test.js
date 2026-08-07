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
import Company from "../../src/models/company.model.js";
import { DEFAULT_PASSWORD } from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

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

const prepareDraftProfile = async (agent, accessToken, profile) => {
  const response = await agent
    .patch("/api/company")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(profile);

  expect(response.status).toBe(200);

  return response.body.company;
};

describe("POST /api/company/submit", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("submits the owned Company with an immutable review snapshot and PENDING state", async () => {
    const agent = createTestAgent();

    const registration = await registerCompanyManager(agent, {
      email: "submit.success@example.com",
    });
    const loginResponse = await loginAs(agent, {
      email: "submit.success@example.com",
    });

    await prepareDraftProfile(agent, loginResponse.accessToken, {
      name: "Acme Submitted",
      logoUrl: "https://cdn.example/logo.png",
      website: "https://acme.example",
      address: "1 Market St",
      description: "Submitted draft",
      contactInfo: "ops@acme.example",
      businessRegistrationNumber: "BRN-SUBMIT-1",
    });

    const beforeSubmit = Date.now();

    const response = await agent
      .post("/api/company/submit")
      .set("Authorization", `Bearer ${loginResponse.accessToken}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/submitted for review/i);
    expect(response.body.company).toMatchObject({
      id: registration.company.id,
      managerUserId: registration.user.id,
      name: "Acme Submitted",
      businessRegistrationNumber: "BRN-SUBMIT-1",
      approvalStatus: COMPANY_APPROVAL_STATUS.PENDING,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
      reviewSnapshot: {
        name: "Acme Submitted",
        logoUrl: "https://cdn.example/logo.png",
        bannerUrl: null,
        website: "https://acme.example",
        address: "1 Market St",
        description: "Submitted draft",
        contactInfo: "ops@acme.example",
        businessRegistrationNumber: "BRN-SUBMIT-1",
      },
    });
    expect(new Date(response.body.company.submittedAt).getTime()).toBeGreaterThanOrEqual(
      beforeSubmit,
    );

    const persistedCompany = await Company.findById(registration.company.id);

    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.PENDING,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(persistedCompany.reviewSnapshot).toMatchObject({
      name: "Acme Submitted",
      businessRegistrationNumber: "BRN-SUBMIT-1",
    });
    expect(persistedCompany.submittedAt).not.toBeNull();
  });

  it("rejects submit when required profile fields are missing", async () => {
    const agent = createTestAgent();

    await registerCompanyManager(agent, {
      email: "submit.missing@example.com",
    });
    const loginResponse = await loginAs(agent, {
      email: "submit.missing@example.com",
    });

    const missingName = await agent
      .post("/api/company/submit")
      .set("Authorization", `Bearer ${loginResponse.accessToken}`)
      .send();

    expect(missingName.status).toBe(400);
    expect(missingName.body.error.message).toMatch(/name is required/i);

    await prepareDraftProfile(agent, loginResponse.accessToken, {
      name: "Name Only Company",
    });

    const missingBusinessRegistrationNumber = await agent
      .post("/api/company/submit")
      .set("Authorization", `Bearer ${loginResponse.accessToken}`)
      .send();

    expect(missingBusinessRegistrationNumber.status).toBe(400);
    expect(missingBusinessRegistrationNumber.body.error.message).toMatch(
      /business registration number is required/i,
    );

    const company = await Company.findOne({
      name: "Name Only Company",
    });

    expect(company.approvalStatus).toBe(COMPANY_APPROVAL_STATUS.NOT_SUBMITTED);
    expect(company.reviewSnapshot).toBeNull();
    expect(company.submittedAt).toBeNull();
  });

  it("rejects submit when business registration number already belongs to another Company", async () => {
    const agent = createTestAgent();

    await registerCompanyManager(agent, {
      email: "submit.brn.a@example.com",
      fullName: "Manager A",
    });
    await registerCompanyManager(agent, {
      email: "submit.brn.b@example.com",
      fullName: "Manager B",
    });

    const firstLogin = await loginAs(agent, {
      email: "submit.brn.a@example.com",
    });
    const secondLogin = await loginAs(agent, {
      email: "submit.brn.b@example.com",
    });

    await prepareDraftProfile(agent, firstLogin.accessToken, {
      name: "First Company",
      businessRegistrationNumber: "BRN-SHARED-1",
    });
    await agent
      .post("/api/company/submit")
      .set("Authorization", `Bearer ${firstLogin.accessToken}`)
      .send();

    const duplicateDraft = await agent
      .patch("/api/company")
      .set("Authorization", `Bearer ${secondLogin.accessToken}`)
      .send({
        name: "Second Company",
        businessRegistrationNumber: "BRN-SHARED-1",
      });

    expect(duplicateDraft.status).toBe(409);
    expect(duplicateDraft.body.error.message).toMatch(
      /business registration number is already registered/i,
    );

    await prepareDraftProfile(agent, secondLogin.accessToken, {
      name: "Second Company",
      businessRegistrationNumber: "BRN-UNIQUE-2",
    });

    const realFindOne = Company.findOne.bind(Company);
    const findOneSpy = vi
      .spyOn(Company, "findOne")
      .mockImplementation((query, ...rest) => {
        if (
          query?.businessRegistrationNumber != null &&
          query._id?.$ne != null
        ) {
          return {
            select: () => Promise.resolve({ _id: "other-company" }),
          };
        }

        return realFindOne(query, ...rest);
      });

    try {
      const duplicateSubmit = await agent
        .post("/api/company/submit")
        .set("Authorization", `Bearer ${secondLogin.accessToken}`)
        .send();

      expect(duplicateSubmit.status).toBe(409);
      expect(duplicateSubmit.body.error.message).toMatch(
        /business registration number is already registered/i,
      );
    } finally {
      findOneSpy.mockRestore();
    }

    const persistedSecondCompany = await Company.findOne({
      name: "Second Company",
    });

    expect(persistedSecondCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
    );
    expect(persistedSecondCompany.reviewSnapshot).toBeNull();
  });

  it("rejects a second submit and freezes draft updates after the first successful submit", async () => {
    const agent = createTestAgent();

    const registration = await registerCompanyManager(agent, {
      email: "submit.once@example.com",
    });
    const loginResponse = await loginAs(agent, {
      email: "submit.once@example.com",
    });

    await prepareDraftProfile(agent, loginResponse.accessToken, {
      name: "One Submit Co",
      businessRegistrationNumber: "BRN-ONCE-1",
      description: "Original snapshot description",
    });

    const firstSubmit = await agent
      .post("/api/company/submit")
      .set("Authorization", `Bearer ${loginResponse.accessToken}`)
      .send();

    expect(firstSubmit.status).toBe(200);

    const snapshotAfterSubmit = firstSubmit.body.company.reviewSnapshot;

    const secondSubmit = await agent
      .post("/api/company/submit")
      .set("Authorization", `Bearer ${loginResponse.accessToken}`)
      .send();

    expect(secondSubmit.status).toBe(409);
    expect(secondSubmit.body.error.message).toMatch(/only be submitted once/i);

    const draftUpdate = await agent
      .patch("/api/company")
      .set("Authorization", `Bearer ${loginResponse.accessToken}`)
      .send({
        name: "Mutated After Submit",
        description: "Must not change snapshot",
      });

    expect(draftUpdate.status).toBe(409);

    const persistedCompany = await Company.findById(registration.company.id);

    expect(persistedCompany.name).toBe("One Submit Co");
    expect(persistedCompany.description).toBe("Original snapshot description");
    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.PENDING,
    );
    expect(persistedCompany.reviewSnapshot.toObject()).toMatchObject(
      snapshotAfterSubmit,
    );
  });

  it("submits only the authenticated manager's Company and ignores client-supplied company identifiers", async () => {
    const agent = createTestAgent();

    const firstRegistration = await registerCompanyManager(agent, {
      email: "submit.tenant.a@example.com",
      fullName: "Manager A",
    });
    const secondRegistration = await registerCompanyManager(agent, {
      email: "submit.tenant.b@example.com",
      fullName: "Manager B",
    });

    const firstLogin = await loginAs(agent, {
      email: "submit.tenant.a@example.com",
    });
    const secondLogin = await loginAs(agent, {
      email: "submit.tenant.b@example.com",
    });

    await prepareDraftProfile(agent, firstLogin.accessToken, {
      name: "Tenant A",
      businessRegistrationNumber: "BRN-TENANT-A",
    });
    await prepareDraftProfile(agent, secondLogin.accessToken, {
      name: "Tenant B",
      businessRegistrationNumber: "BRN-TENANT-B",
    });

    const firstSubmit = await agent
      .post("/api/company/submit")
      .set("Authorization", `Bearer ${firstLogin.accessToken}`)
      .send({
        companyId: secondRegistration.company.id,
      });

    expect(firstSubmit.status).toBe(200);
    expect(firstSubmit.body.company.id).toBe(firstRegistration.company.id);
    expect(firstSubmit.body.company.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.PENDING,
    );

    const secondCompany = await Company.findById(secondRegistration.company.id);

    expect(secondCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
    );
    expect(secondCompany.reviewSnapshot).toBeNull();
    expect(secondCompany.submittedAt).toBeNull();
  });
});
