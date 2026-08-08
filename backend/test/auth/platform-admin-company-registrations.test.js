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
import Company from "../../src/models/company.model.js";
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
import mongoose from "mongoose";

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

describe("GET /api/platform-admin/company-registrations", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("lists submitted Company registrations with manager and approval state for Platform Admin", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "admin.list@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });

    const first = await registerAndSubmitCompany(agent, {
      email: "manager.list.a@example.com",
      fullName: "Manager A",
      companyName: "Alpha Co",
      businessRegistrationNumber: "BRN-LIST-A",
    });
    const second = await registerAndSubmitCompany(agent, {
      email: "manager.list.b@example.com",
      fullName: "Manager B",
      companyName: "Beta Co",
      businessRegistrationNumber: "BRN-LIST-B",
    });

    await agent.post("/api/auth/register/company-manager").send({
      fullName: "Draft Only Manager",
      email: "manager.draft.only@example.com",
      password: DEFAULT_PASSWORD,
    });

    const adminAccessToken = await loginAndGetAccessToken(agent, {
      email: "admin.list@example.com",
    });

    const response = await agent
      .get("/api/platform-admin/company-registrations")
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.companyRegistrations).toHaveLength(2);
    expect(response.body.companyRegistrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: first.company.id,
          companyName: "Alpha Co",
          businessRegistrationNumber: "BRN-LIST-A",
          approvalStatus: COMPANY_APPROVAL_STATUS.PENDING,
          operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
          manager: expect.objectContaining({
            id: first.manager.id,
            fullName: "Manager A",
            email: "manager.list.a@example.com",
            role: USER_ROLE.COMPANY_STAFF,
            status: USER_STATUS.PENDING_ACTIVATION,
          }),
        }),
        expect.objectContaining({
          id: second.company.id,
          companyName: "Beta Co",
          businessRegistrationNumber: "BRN-LIST-B",
          approvalStatus: COMPANY_APPROVAL_STATUS.PENDING,
          manager: expect.objectContaining({
            id: second.manager.id,
            email: "manager.list.b@example.com",
          }),
        }),
      ]),
    );
  });

  it("rejects company-registration list access for non-Platform-Admin actors", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "candidate.list@example.com",
      role: USER_ROLE.CANDIDATE,
    });

    const candidateAccessToken = await loginAndGetAccessToken(agent, {
      email: "candidate.list@example.com",
    });

    const candidateResponse = await agent
      .get("/api/platform-admin/company-registrations")
      .set("Authorization", `Bearer ${candidateAccessToken}`);

    expect(candidateResponse.status).toBe(403);

    const { onboardingAccessToken } = await registerAndSubmitCompany(agent, {
      email: "manager.list.authz@example.com",
      companyName: "Authz Co",
      businessRegistrationNumber: "BRN-LIST-AUTHZ",
    });

    const onboardingResponse = await agent
      .get("/api/platform-admin/company-registrations")
      .set("Authorization", `Bearer ${onboardingAccessToken}`);

    expect(onboardingResponse.status).toBe(403);
  });
});

describe("GET /api/platform-admin/company-registrations/:companyId", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("returns registration detail with manager association and immutable reviewSnapshot as review source", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "admin.detail@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });

    const submitted = await registerAndSubmitCompany(agent, {
      email: "manager.detail@example.com",
      fullName: "Detail Manager",
      companyName: "Snapshot Source Co",
      businessRegistrationNumber: "BRN-DETAIL-1",
      description: "Snapshot description",
    });

    // Force live profile divergence without changing immutable snapshot.
    await Company.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(submitted.company.id) },
      {
        $set: {
          name: "Live Profile Must Not Be Used",
          description: "Live description must not be used for review",
        },
      },
    );

    const adminAccessToken = await loginAndGetAccessToken(agent, {
      email: "admin.detail@example.com",
    });

    const response = await agent
      .get(`/api/platform-admin/company-registrations/${submitted.company.id}`)
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.companyRegistration).toMatchObject({
      id: submitted.company.id,
      approvalStatus: COMPANY_APPROVAL_STATUS.PENDING,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
      manager: {
        id: submitted.manager.id,
        fullName: "Detail Manager",
        email: "manager.detail@example.com",
        role: USER_ROLE.COMPANY_STAFF,
        status: USER_STATUS.PENDING_ACTIVATION,
      },
      reviewSnapshot: {
        name: "Snapshot Source Co",
        businessRegistrationNumber: "BRN-DETAIL-1",
        description: "Snapshot description",
        website: "https://example.com",
      },
    });
    expect(response.body.companyRegistration.name).toBeUndefined();
    expect(response.body.companyRegistration.description).toBeUndefined();
    expect(response.body.companyRegistration.reviewSnapshot.name).not.toBe(
      "Live Profile Must Not Be Used",
    );

    const persistedCompany = await Company.findById(submitted.company.id);

    expect(persistedCompany.name).toBe("Live Profile Must Not Be Used");
    expect(persistedCompany.reviewSnapshot.name).toBe("Snapshot Source Co");
  });

  it("rejects detail access for non-admins and omits unsubmitted Companies from review scope", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "admin.detail.authz@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });
    await createVerifiedUser({
      email: "candidate.detail@example.com",
      role: USER_ROLE.CANDIDATE,
    });

    const draftRegistration = await agent
      .post("/api/auth/register/company-manager")
      .send({
        fullName: "Unsubmitted Manager",
        email: "manager.unsubmitted@example.com",
        password: DEFAULT_PASSWORD,
      });

    expect(draftRegistration.status).toBe(201);

    const submitted = await registerAndSubmitCompany(agent, {
      email: "manager.detail.authz@example.com",
      companyName: "Authz Detail Co",
      businessRegistrationNumber: "BRN-DETAIL-AUTHZ",
    });

    const candidateAccessToken = await loginAndGetAccessToken(agent, {
      email: "candidate.detail@example.com",
    });

    const candidateResponse = await agent
      .get(`/api/platform-admin/company-registrations/${submitted.company.id}`)
      .set("Authorization", `Bearer ${candidateAccessToken}`);

    expect(candidateResponse.status).toBe(403);

    const adminAccessToken = await loginAndGetAccessToken(agent, {
      email: "admin.detail.authz@example.com",
    });

    const unsubmittedResponse = await agent
      .get(
        `/api/platform-admin/company-registrations/${draftRegistration.body.company.id}`,
      )
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(unsubmittedResponse.status).toBe(404);

    const unknownResponse = await agent
      .get("/api/platform-admin/company-registrations/not-a-valid-object-id")
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(unknownResponse.status).toBe(400);
  });
});
