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
import CompanyMember from "../../src/models/company-member.model.js";
import User from "../../src/models/user.model.js";
import {
  submitOwnedCompany,
  updateOwnedCompanyActiveProfile,
  updateOwnedCompanyDraft,
} from "../../src/services/company.service.js";
import {
  approveCompanyRegistration,
  lockCompany,
  rejectCompanyRegistration,
} from "../../src/services/platform-admin.service.js";
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

const wrapQueryWithReadBarrier = (
  query,
  { onRead, holdReads },
) => {
  const run = async () => {
    const document = await query;
    onRead();
    await holdReads;
    return document;
  };

  return {
    then: (onFulfilled, onRejected) => run().then(onFulfilled, onRejected),
    select: (...selectArgs) =>
      wrapQueryWithReadBarrier(query.select(...selectArgs), {
        onRead,
        holdReads,
      }),
    session: (session) =>
      wrapQueryWithReadBarrier(query.session(session), {
        onRead,
        holdReads,
      }),
  };
};

const installManagerFindOneBarrier = () => {
  const originalFindOne = CompanyMember.findOne.bind(CompanyMember);
  let releaseReads;
  const holdReads = new Promise((resolve) => {
    releaseReads = resolve;
  });
  let startedReads = 0;
  let resolveBothReads;
  const bothReadsStarted = new Promise((resolve) => {
    resolveBothReads = resolve;
  });

  vi.spyOn(CompanyMember, "findOne").mockImplementation((filter, ...rest) => {
    const query = originalFindOne(filter, ...rest);

    if (filter == null || filter.userId == null) {
      return query;
    }

    return wrapQueryWithReadBarrier(query, {
      holdReads,
      onRead: () => {
        startedReads += 1;
        if (startedReads >= 2) {
          resolveBothReads();
        }
      },
    });
  });

  return {
    awaitBothReads: () => bothReadsStarted,
    releaseReads: () => releaseReads(),
  };
};

const installOwnedCompanyFindOneBarrier = () => {
  const originalFindOne = CompanyMember.findOne.bind(CompanyMember);
  let releaseRead;
  const holdRead = new Promise((resolve) => {
    releaseRead = resolve;
  });
  let resolveReadStarted;
  const readStarted = new Promise((resolve) => {
    resolveReadStarted = resolve;
  });

  vi.spyOn(CompanyMember, "findOne").mockImplementation((filter, ...rest) => {
    const query = originalFindOne(filter, ...rest);

    if (filter == null || filter.userId == null) {
      return query;
    }

    return wrapQueryWithReadBarrier(query, {
      holdReads: holdRead,
      onRead: () => {
        resolveReadStarted();
      },
    });
  });

  return {
    awaitRead: () => readStarted,
    releaseRead: () => releaseRead(),
  };
};
const extractConfirmationTokenFromMailCall = (mailCall) => {
  const match = mailCall.html.match(/confirm-company-approval\?token=([^"]+)/);

  return decodeURIComponent(match[1]);
};

const registerActivatedCompany = async (
  agent,
  {
    managerEmail,
    adminEmail,
    companyName,
    businessRegistrationNumber,
  },
) => {
  await createVerifiedUser({
    email: adminEmail,
    role: USER_ROLE.PLATFORM_ADMIN,
  });

  const registration = await agent
    .post("/api/auth/register/company-manager")
    .send({
      fullName: "Active Race Manager",
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
      description: "Pre-lock description",
      website: "https://pre-lock.example",
      logoUrl: "https://cdn.example/pre-lock-logo.png",
      bannerUrl: "https://cdn.example/pre-lock-banner.png",
      address: "1 Pre Lock Street",
      contactInfo: "pre-lock@example.com",
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

  const rawToken = extractConfirmationTokenFromMailCall(
    sendMail.mock.calls.at(-1)[0],
  );

  const confirmResponse = await agent
    .post("/api/auth/confirm-company-approval")
    .send({ token: rawToken });

  expect(confirmResponse.status).toBe(200);

  return {
    companyId: submitResponse.body.company.id,
    managerId: registration.body.user.id,
  };
};

const registerDraftReadyCompany = async (
  agent,
  {
    email,
    companyName,
    businessRegistrationNumber,
    description = "Concurrency draft",
  },
) => {
  const registration = await agent
    .post("/api/auth/register/company-manager")
    .send({
      fullName: "Concurrency Manager",
      email,
      password: DEFAULT_PASSWORD,
    });

  expect(registration.status).toBe(201);

  const accessToken = await loginAndGetAccessToken(agent, { email });

  const draftResponse = await agent
    .patch("/api/company")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      name: companyName,
      businessRegistrationNumber,
      description,
    });

  expect(draftResponse.status).toBe(200);

  return {
    accessToken,
    companyId: draftResponse.body.company.id,
    managerId: registration.body.user.id,
  };
};

const registerSubmittedCompany = async (agent, options) => {
  const draft = await registerDraftReadyCompany(agent, options);
  const submitResponse = await agent
    .post("/api/company/submit")
    .set("Authorization", `Bearer ${draft.accessToken}`)
    .send();

  expect(submitResponse.status).toBe(200);

  return {
    ...draft,
    company: submitResponse.body.company,
  };
};

const settledServiceOutcome = (result) => {
  if (result.status === "fulfilled") {
    return { ok: true, value: result.value };
  }

  return {
    ok: false,
    statusCode: result.reason?.statusCode,
  };
};

describe("Company lifecycle source-state concurrency", () => {
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

  it("does not let a concurrent draft update commit after submit changes source state", async () => {
    const agent = createTestAgent();
    const prepared = await registerDraftReadyCompany(agent, {
      email: "manager.draft-submit-race@example.com",
      companyName: "Original Name",
      businessRegistrationNumber: "BRN-DRAFT-SUBMIT-RACE",
      description: "Original description",
    });

    const barrier = installManagerFindOneBarrier();

    const draftPromise = updateOwnedCompanyDraft({
      managerUserId: prepared.managerId,
      profile: {
        name: "Race Overwrite Name",
        description: "Race overwrite description",
      },
    });
    const submitPromise = submitOwnedCompany({
      managerUserId: prepared.managerId,
    });

    await barrier.awaitBothReads();
    barrier.releaseReads();

    const [draftResult, submitResult] = await Promise.allSettled([
      draftPromise,
      submitPromise,
    ]);
    const draftOutcome = settledServiceOutcome(draftResult);
    const submitOutcome = settledServiceOutcome(submitResult);

    const persisted = await Company.findById(prepared.companyId);

    if (persisted.approvalStatus === COMPANY_APPROVAL_STATUS.PENDING) {
      expect(submitOutcome.ok).toBe(true);
      expect(persisted.operationalStatus).toBe(
        COMPANY_OPERATIONAL_STATUS.INACTIVE,
      );
      expect(persisted.reviewSnapshot).not.toBeNull();
      expect(persisted.name).toBe(persisted.reviewSnapshot.name);
      expect(persisted.description).toBe(persisted.reviewSnapshot.description);

      if (!draftOutcome.ok) {
        expect(draftOutcome.statusCode).toBe(409);
        expect(persisted.reviewSnapshot.name).toBe("Original Name");
      } else {
        expect(persisted.reviewSnapshot.name).toBe("Race Overwrite Name");
      }
    } else {
      expect(persisted.approvalStatus).toBe(
        COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
      );
      expect(persisted.reviewSnapshot).toBeNull();
      expect(draftOutcome.ok).toBe(true);
      expect(submitOutcome.ok).toBe(false);
      expect(submitOutcome.statusCode).toBe(409);
    }
  });

  it("allows only one concurrent reject to succeed from PENDING + INACTIVE", async () => {
    const agent = createTestAgent();

    const { user: adminA } = await createVerifiedUser({
      email: "admin.reject-a@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });
    const { user: adminB } = await createVerifiedUser({
      email: "admin.reject-b@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });

    const submitted = await registerSubmittedCompany(agent, {
      email: "manager.reject-reject-race@example.com",
      companyName: "Reject Race Co",
      businessRegistrationNumber: "BRN-REJECT-REJECT-RACE",
    });

    const results = await Promise.allSettled([
      rejectCompanyRegistration({
        companyId: submitted.companyId,
        actorUserId: adminA._id,
      }),
      rejectCompanyRegistration({
        companyId: submitted.companyId,
        actorUserId: adminB._id,
      }),
    ]);
    const outcomes = results.map(settledServiceOutcome);
    const successes = outcomes.filter((outcome) => outcome.ok);
    const failures = outcomes.filter((outcome) => !outcome.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].statusCode).toBe(409);

    const persisted = await Company.findById(submitted.companyId);

    expect(persisted.approvalStatus).toBe(COMPANY_APPROVAL_STATUS.REJECTED);
    expect(persisted.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(persisted.reviewedByUserId.toString()).toBe(
      successes[0].value.reviewedByUserId,
    );
  });

  it("does not let approve and reject both succeed from the same PENDING source state", async () => {
    const agent = createTestAgent();

    const { user: approveAdmin } = await createVerifiedUser({
      email: "admin.approve-race@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });
    const { user: rejectAdmin } = await createVerifiedUser({
      email: "admin.reject-race@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });

    const submitted = await registerSubmittedCompany(agent, {
      email: "manager.approve-reject-race@example.com",
      companyName: "Approve Reject Race Co",
      businessRegistrationNumber: "BRN-APPROVE-REJECT-RACE",
    });

    const results = await Promise.allSettled([
      approveCompanyRegistration({
        companyId: submitted.companyId,
        actorUserId: approveAdmin._id,
      }),
      rejectCompanyRegistration({
        companyId: submitted.companyId,
        actorUserId: rejectAdmin._id,
      }),
    ]);
    const outcomes = results.map(settledServiceOutcome);
    const successes = outcomes.filter((outcome) => outcome.ok);
    const failures = outcomes.filter((outcome) => !outcome.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].statusCode).toBe(409);

    const persisted = await Company.findById(submitted.companyId);
    const manager = await User.findById(submitted.managerId);

    expect(persisted.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect([
      COMPANY_APPROVAL_STATUS.APPROVED,
      COMPANY_APPROVAL_STATUS.REJECTED,
    ]).toContain(persisted.approvalStatus);
    expect(manager.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(successes[0].value.approvalStatus).toBe(persisted.approvalStatus);
  });

  it("does not let an F09 active-profile update commit after F10 locks the Company", async () => {
    const agent = createTestAgent();

    const activated = await registerActivatedCompany(agent, {
      managerEmail: "manager.f09-f10-race@example.com",
      adminEmail: "admin.f09-f10-race@example.com",
      companyName: "F09 F10 Race Co",
      businessRegistrationNumber: "BRN-F09-F10-RACE",
    });

    const companyBefore = await Company.findById(activated.companyId);
    const profileBefore = {
      logoUrl: companyBefore.logoUrl,
      bannerUrl: companyBefore.bannerUrl,
      website: companyBefore.website,
      address: companyBefore.address,
      description: companyBefore.description,
      contactInfo: companyBefore.contactInfo,
    };

    const barrier = installOwnedCompanyFindOneBarrier();

    const updatePromise = updateOwnedCompanyActiveProfile({
      managerUserId: activated.managerId,
      profile: {
        website: "https://should-not-commit-after-lock.example",
        description: "Should not commit after lock",
        contactInfo: "should-not-commit@example.com",
      },
    });

    await barrier.awaitRead();

    await lockCompany({ companyId: activated.companyId });

    barrier.releaseRead();

    const updateResult = await Promise.allSettled([updatePromise]);
    CompanyMember.findOne.mockRestore();

    const updateOutcome = settledServiceOutcome(updateResult[0]);
    const persistedCompany = await Company.findById(activated.companyId);
    const persistedManager = await User.findById(activated.managerId);

    expect(updateOutcome.ok).toBe(false);
    expect(updateOutcome.statusCode).toBe(409);

    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.APPROVED,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.LOCKED,
    );
    expect(persistedManager.status).toBe(USER_STATUS.TERMINATED);
    expect(persistedCompany.logoUrl).toBe(profileBefore.logoUrl);
    expect(persistedCompany.bannerUrl).toBe(profileBefore.bannerUrl);
    expect(persistedCompany.website).toBe(profileBefore.website);
    expect(persistedCompany.address).toBe(profileBefore.address);
    expect(persistedCompany.description).toBe(profileBefore.description);
    expect(persistedCompany.contactInfo).toBe(profileBefore.contactInfo);
  });
});
