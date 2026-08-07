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
import Company from "../../src/models/company.model.js";
import User from "../../src/models/user.model.js";
import sendMail from "../../src/services/mail.service.js";
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

vi.mock("../../src/services/mail.service.js", () => ({
  default: vi.fn().mockResolvedValue({ messageId: "test-message-id" }),
}));

const extractConfirmationTokenFromMailCall = (mailCall) => {
  const match = mailCall.html.match(/confirm-company-approval\?token=([^"]+)/);

  return decodeURIComponent(match[1]);
};

const registerActivateOwnedCompany = async (
  agent,
  {
    managerEmail,
    adminEmail,
    companyName,
    businessRegistrationNumber,
    fullName = "Chris Manager",
    description = "Active company profile",
    website = "https://example.com",
  },
) => {
  await createVerifiedUser({
    email: adminEmail,
    role: USER_ROLE.PLATFORM_ADMIN,
  });

  const registration = await agent
    .post("/api/auth/register/company-manager")
    .send({
      fullName,
      email: managerEmail,
      password: DEFAULT_PASSWORD,
    });

  expect(registration.status).toBe(201);

  const onboardingAccessToken = await loginAndGetAccessToken(agent, {
    email: managerEmail,
  });

  const draftResponse = await agent
    .patch("/api/company")
    .set("Authorization", `Bearer ${onboardingAccessToken}`)
    .send({
      name: companyName,
      businessRegistrationNumber,
      description,
      website,
      logoUrl: "https://cdn.example/logo-original.png",
      bannerUrl: "https://cdn.example/banner-original.png",
      address: "1 Original Street",
      contactInfo: "original@example.com",
    });

  expect(draftResponse.status).toBe(200);

  const submitResponse = await agent
    .post("/api/company/submit")
    .set("Authorization", `Bearer ${onboardingAccessToken}`)
    .send();

  expect(submitResponse.status).toBe(200);

  const adminAccessToken = await loginAndGetAccessToken(agent, {
    email: adminEmail,
  });

  const approveResponse = await agent
    .post(
      `/api/platform-admin/company-registrations/${submitResponse.body.company.id}/approve`,
    )
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .send();

  expect(approveResponse.status).toBe(200);
  expect(sendMail).toHaveBeenCalled();

  const rawToken = extractConfirmationTokenFromMailCall(
    sendMail.mock.calls.at(-1)[0],
  );

  const confirmResponse = await agent
    .post("/api/auth/confirm-company-approval")
    .send({ token: rawToken });

  expect(confirmResponse.status).toBe(200);
  expect(confirmResponse.body.user.status).toBe(USER_STATUS.ACTIVE);
  expect(confirmResponse.body.company.approvalStatus).toBe(
    COMPANY_APPROVAL_STATUS.APPROVED,
  );
  expect(confirmResponse.body.company.operationalStatus).toBe(
    COMPANY_OPERATIONAL_STATUS.ACTIVE,
  );

  const accessToken = await loginAndGetAccessToken(agent, {
    email: managerEmail,
  });

  return {
    accessToken,
    companyId: confirmResponse.body.company.id,
    managerId: registration.body.user.id,
    reviewSnapshot: confirmResponse.body.company.reviewSnapshot,
    company: confirmResponse.body.company,
  };
};

describe("Active Company profile management (F09)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("lets an ACTIVE Company Manager get and update allowed fields on APPROVED + ACTIVE Company", async () => {
    const agent = createTestAgent();

    const activated = await registerActivateOwnedCompany(agent, {
      managerEmail: "active.owner@example.com",
      adminEmail: "admin.active.owner@example.com",
      companyName: "Active Acme",
      businessRegistrationNumber: "BRN-ACTIVE-1",
    });

    const getResponse = await agent
      .get("/api/company")
      .set("Authorization", `Bearer ${activated.accessToken}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.company).toMatchObject({
      id: activated.companyId,
      managerUserId: activated.managerId,
      name: "Active Acme",
      businessRegistrationNumber: "BRN-ACTIVE-1",
      approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.ACTIVE,
    });

    const before = await Company.findById(activated.companyId);
    const immutableBefore = {
      name: before.name,
      businessRegistrationNumber: before.businessRegistrationNumber,
      managerUserId: before.managerUserId.toString(),
      approvalStatus: before.approvalStatus,
      operationalStatus: before.operationalStatus,
      reviewSnapshot: before.reviewSnapshot.toObject(),
      submittedAt: before.submittedAt?.toISOString(),
      reviewedByUserId: before.reviewedByUserId?.toString(),
      reviewedAt: before.reviewedAt?.toISOString(),
      activatedAt: before.activatedAt?.toISOString(),
    };

    const patchResponse = await agent
      .patch("/api/company")
      .set("Authorization", `Bearer ${activated.accessToken}`)
      .send({
        logoUrl: "https://cdn.example/logo-updated.png",
        bannerUrl: "https://cdn.example/banner-updated.png",
        website: "https://updated.example",
        address: "99 Updated Avenue",
        description: "Updated active description",
        contactInfo: "updated@example.com",
      });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.company).toMatchObject({
      id: activated.companyId,
      logoUrl: "https://cdn.example/logo-updated.png",
      bannerUrl: "https://cdn.example/banner-updated.png",
      website: "https://updated.example",
      address: "99 Updated Avenue",
      description: "Updated active description",
      contactInfo: "updated@example.com",
      name: "Active Acme",
      businessRegistrationNumber: "BRN-ACTIVE-1",
      approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.ACTIVE,
    });

    const after = await Company.findById(activated.companyId);

    expect(after.logoUrl).toBe("https://cdn.example/logo-updated.png");
    expect(after.bannerUrl).toBe("https://cdn.example/banner-updated.png");
    expect(after.website).toBe("https://updated.example");
    expect(after.address).toBe("99 Updated Avenue");
    expect(after.description).toBe("Updated active description");
    expect(after.contactInfo).toBe("updated@example.com");
    expect(after.name).toBe(immutableBefore.name);
    expect(after.businessRegistrationNumber).toBe(
      immutableBefore.businessRegistrationNumber,
    );
    expect(after.managerUserId.toString()).toBe(immutableBefore.managerUserId);
    expect(after.approvalStatus).toBe(immutableBefore.approvalStatus);
    expect(after.operationalStatus).toBe(immutableBefore.operationalStatus);
    expect(after.reviewSnapshot.toObject()).toEqual(
      immutableBefore.reviewSnapshot,
    );
    expect(after.submittedAt?.toISOString()).toBe(immutableBefore.submittedAt);
    expect(after.reviewedByUserId?.toString()).toBe(
      immutableBefore.reviewedByUserId,
    );
    expect(after.reviewedAt?.toISOString()).toBe(immutableBefore.reviewedAt);
    expect(after.activatedAt?.toISOString()).toBe(immutableBefore.activatedAt);
  });

  it("resolves tenant ownership from the authenticated manager and blocks cross-tenant identifiers", async () => {
    const agent = createTestAgent();

    const first = await registerActivateOwnedCompany(agent, {
      managerEmail: "tenant.active.a@example.com",
      adminEmail: "admin.tenant.active.a@example.com",
      companyName: "Tenant A Active",
      businessRegistrationNumber: "BRN-TENANT-A-ACTIVE",
      fullName: "Manager A",
    });
    const second = await registerActivateOwnedCompany(agent, {
      managerEmail: "tenant.active.b@example.com",
      adminEmail: "admin.tenant.active.b@example.com",
      companyName: "Tenant B Active",
      businessRegistrationNumber: "BRN-TENANT-B-ACTIVE",
      fullName: "Manager B",
    });

    const rejectedClientCompanyId = await agent
      .patch("/api/company")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .send({
        companyId: second.companyId,
        website: "https://should-not-cross.example",
      });

    expect(rejectedClientCompanyId.status).toBe(400);

    const firstPatch = await agent
      .patch("/api/company")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .send({
        website: "https://tenant-a-only.example",
      });

    expect(firstPatch.status).toBe(200);
    expect(firstPatch.body.company.id).toBe(first.companyId);
    expect(firstPatch.body.company.website).toBe(
      "https://tenant-a-only.example",
    );

    const secondGet = await agent
      .get("/api/company")
      .set("Authorization", `Bearer ${second.accessToken}`);

    expect(secondGet.status).toBe(200);
    expect(secondGet.body.company.id).toBe(second.companyId);
    expect(secondGet.body.company.website).toBe("https://example.com");

    const firstCompany = await Company.findById(first.companyId);
    const secondCompany = await Company.findById(second.companyId);

    expect(firstCompany.website).toBe("https://tenant-a-only.example");
    expect(secondCompany.website).toBe("https://example.com");
  });

  it("rejects forbidden field updates including name, BRN, state, and snapshot", async () => {
    const agent = createTestAgent();

    const activated = await registerActivateOwnedCompany(agent, {
      managerEmail: "forbidden.fields@example.com",
      adminEmail: "admin.forbidden.fields@example.com",
      companyName: "Immutable Name Co",
      businessRegistrationNumber: "BRN-IMMUTABLE-1",
    });

    const before = await Company.findById(activated.companyId);
    const snapshotBefore = before.reviewSnapshot.toObject();

    const forbiddenPayloads = [
      { name: "Hacked Name" },
      { businessRegistrationNumber: "BRN-HACKED" },
      { managerUserId: activated.managerId },
      { approvalStatus: COMPANY_APPROVAL_STATUS.PENDING },
      { operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED },
      { reviewSnapshot: { name: "Tampered Snapshot" } },
      { submittedAt: new Date().toISOString() },
      { reviewedAt: new Date().toISOString() },
      { activatedAt: new Date().toISOString() },
    ];

    for (const payload of forbiddenPayloads) {
      const response = await agent
        .patch("/api/company")
        .set("Authorization", `Bearer ${activated.accessToken}`)
        .send(payload);

      expect(response.status).toBe(400);
    }

    const after = await Company.findById(activated.companyId);

    expect(after.name).toBe("Immutable Name Co");
    expect(after.businessRegistrationNumber).toBe("BRN-IMMUTABLE-1");
    expect(after.managerUserId.toString()).toBe(activated.managerId);
    expect(after.approvalStatus).toBe(COMPANY_APPROVAL_STATUS.APPROVED);
    expect(after.operationalStatus).toBe(COMPANY_OPERATIONAL_STATUS.ACTIVE);
    expect(after.reviewSnapshot.toObject()).toEqual(snapshotBefore);
  });

  it("rejects active profile access when Company is not APPROVED + ACTIVE", async () => {
    const agent = createTestAgent();

    const activated = await registerActivateOwnedCompany(agent, {
      managerEmail: "invalid.state@example.com",
      adminEmail: "admin.invalid.state@example.com",
      companyName: "Soon Locked Co",
      businessRegistrationNumber: "BRN-LOCKED-STATE-1",
    });

    const company = await Company.findById(activated.companyId);
    company.operationalStatus = COMPANY_OPERATIONAL_STATUS.LOCKED;
    await company.save();

    const getResponse = await agent
      .get("/api/company")
      .set("Authorization", `Bearer ${activated.accessToken}`);

    expect(getResponse.status).toBe(409);
    expect(getResponse.body.error.message).toMatch(/APPROVED and ACTIVE/i);

    const patchResponse = await agent
      .patch("/api/company")
      .set("Authorization", `Bearer ${activated.accessToken}`)
      .send({
        website: "https://must-not-update.example",
      });

    expect(patchResponse.status).toBe(409);
    expect(patchResponse.body.error.message).toMatch(/APPROVED and ACTIVE/i);

    const persisted = await Company.findById(activated.companyId);

    expect(persisted.website).toBe("https://example.com");
    expect(persisted.operationalStatus).toBe(COMPANY_OPERATIONAL_STATUS.LOCKED);
    expect(persisted.approvalStatus).toBe(COMPANY_APPROVAL_STATUS.APPROVED);
  });

  it("keeps reviewSnapshot immutable across allowed active profile updates", async () => {
    const agent = createTestAgent();

    const activated = await registerActivateOwnedCompany(agent, {
      managerEmail: "snapshot.immutable@example.com",
      adminEmail: "admin.snapshot.immutable@example.com",
      companyName: "Snapshot Co",
      businessRegistrationNumber: "BRN-SNAPSHOT-1",
      description: "Snapshot original description",
      website: "https://snapshot-original.example",
    });

    const before = await Company.findById(activated.companyId);
    const snapshotBefore = before.reviewSnapshot.toObject();

    expect(snapshotBefore).toMatchObject({
      name: "Snapshot Co",
      businessRegistrationNumber: "BRN-SNAPSHOT-1",
      description: "Snapshot original description",
      website: "https://snapshot-original.example",
    });

    const patchResponse = await agent
      .patch("/api/company")
      .set("Authorization", `Bearer ${activated.accessToken}`)
      .send({
        description: "Live profile changed after activation",
        website: "https://snapshot-live.example",
        logoUrl: "https://cdn.example/live-logo.png",
      });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.company.description).toBe(
      "Live profile changed after activation",
    );
    expect(patchResponse.body.company.website).toBe(
      "https://snapshot-live.example",
    );
    expect(patchResponse.body.company.reviewSnapshot).toEqual(snapshotBefore);

    const after = await Company.findById(activated.companyId);

    expect(after.description).toBe("Live profile changed after activation");
    expect(after.website).toBe("https://snapshot-live.example");
    expect(after.reviewSnapshot.toObject()).toEqual(snapshotBefore);
    expect(after.approvalStatus).toBe(COMPANY_APPROVAL_STATUS.APPROVED);
    expect(after.operationalStatus).toBe(COMPANY_OPERATIONAL_STATUS.ACTIVE);

    const manager = await User.findById(activated.managerId);

    expect(manager.status).toBe(USER_STATUS.ACTIVE);
  });
});
