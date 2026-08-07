import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import AUTH_TOKEN_TYPE from "../../src/constants/auth-token-type.js";
import COMPANY_APPROVAL_STATUS from "../../src/constants/company-approval-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import AuthToken from "../../src/models/auth-token.model.js";
import Company from "../../src/models/company.model.js";
import User from "../../src/models/user.model.js";
import sendMail from "../../src/services/mail.service.js";
import { resendApprovalConfirmation } from "../../src/services/company.service.js";
import { generateAuthToken, hashAuthToken } from "../../src/utils/hash-auth-token.js";
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

const wrapQueryWithReadBarrier = (query, { onRead, holdReads }) => {
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
    session: (...sessionArgs) =>
      wrapQueryWithReadBarrier(query.session(...sessionArgs), {
        onRead,
        holdReads,
      }),
  };
};

const installUsableConfirmationReadBarrier = () => {
  const originalFindOne = AuthToken.findOne.bind(AuthToken);
  let releaseReads;
  const holdReads = new Promise((resolve) => {
    releaseReads = resolve;
  });
  let startedReads = 0;
  let resolveBothReads;
  const bothReadsStarted = new Promise((resolve) => {
    resolveBothReads = resolve;
  });

  vi.spyOn(AuthToken, "findOne").mockImplementation((filter, ...rest) => {
    const query = originalFindOne(filter, ...rest);
    const isUsableConfirmationLookup =
      filter?.type === AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION &&
      filter?.expiresAt?.$gt != null;

    if (!isUsableConfirmationLookup) {
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

const settledServiceOutcome = (result) => {
  if (result.status === "fulfilled") {
    return { ok: true, value: result.value };
  }

  return {
    ok: false,
    statusCode: result.reason?.statusCode,
  };
};

const extractConfirmationTokenFromMailCall = (mailCall) => {
  const match = mailCall.html.match(/confirm-company-approval\?token=([^"]+)/);

  return decodeURIComponent(match[1]);
};

const registerSubmitAndApproveCompany = async (
  agent,
  {
    managerEmail,
    adminEmail,
    companyName,
    businessRegistrationNumber,
    fullName = "Chris Manager",
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
      description: "Ready for confirmation resend",
      website: "https://example.com",
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

  return {
    companyId: submitResponse.body.company.id,
    managerId: registration.body.user.id,
    rawToken,
    onboardingAccessToken,
  };
};

describe("POST /api/company/resend-approval-confirmation", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("resends confirmation when previous token expired, preserves User/Company state, and keeps only one usable confirmation", async () => {
    const agent = createTestAgent();

    const { companyId, managerId, rawToken, onboardingAccessToken } =
      await registerSubmitAndApproveCompany(agent, {
        managerEmail: "manager.resend@example.com",
        adminEmail: "admin.resend@example.com",
        companyName: "Resend Co",
        businessRegistrationNumber: "BRN-RESEND-1",
      });

    const companyBefore = await Company.findById(companyId);
    const managerBefore = await User.findById(managerId);

    await AuthToken.updateOne(
      {
        userId: managerId,
        type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
      },
      { expiresAt: new Date(Date.now() - 1_000) },
    );

    sendMail.mockClear();

    const response = await agent
      .post("/api/company/resend-approval-confirmation")
      .set("Authorization", `Bearer ${onboardingAccessToken}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/resent/i);
    expect(response.body.company).toMatchObject({
      id: companyId,
      approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
      activatedAt: null,
      reviewedByUserId: companyBefore.reviewedByUserId.toString(),
    });

    const companyAfter = await Company.findById(companyId);
    const managerAfter = await User.findById(managerId);
    const confirmationTokens = await AuthToken.find({
      userId: managerId,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
    }).select("+tokenHash");

    expect(managerAfter.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(managerAfter.emailVerifiedAt).toBeNull();
    expect(companyAfter.approvalStatus).toBe(COMPANY_APPROVAL_STATUS.APPROVED);
    expect(companyAfter.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(companyAfter.activatedAt).toBeNull();
    expect(companyAfter.reviewedByUserId.toString()).toBe(
      companyBefore.reviewedByUserId.toString(),
    );
    expect(companyAfter.reviewedAt.getTime()).toBe(
      companyBefore.reviewedAt.getTime(),
    );
    expect(managerBefore.status).toBe(USER_STATUS.PENDING_ACTIVATION);

    expect(confirmationTokens).toHaveLength(1);
    expect(confirmationTokens[0].expiresAt.getTime()).toBeGreaterThan(
      Date.now(),
    );

    expect(sendMail).toHaveBeenCalledOnce();
    const newRawToken = extractConfirmationTokenFromMailCall(
      sendMail.mock.calls[0][0],
    );

    expect(newRawToken).not.toBe(rawToken);
    expect(confirmationTokens[0].tokenHash).toBe(hashAuthToken(newRawToken));
    expect(confirmationTokens[0].tokenHash).not.toBe(hashAuthToken(rawToken));
  });

  it("rejects resend while a usable confirmation token still exists", async () => {
    const agent = createTestAgent();

    const { managerId, onboardingAccessToken, rawToken } =
      await registerSubmitAndApproveCompany(agent, {
        managerEmail: "manager.resend.active@example.com",
        adminEmail: "admin.resend.active@example.com",
        companyName: "Active Token Co",
        businessRegistrationNumber: "BRN-RESEND-ACTIVE",
      });

    sendMail.mockClear();

    const response = await agent
      .post("/api/company/resend-approval-confirmation")
      .set("Authorization", `Bearer ${onboardingAccessToken}`)
      .send();

    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe(
      "A valid approval confirmation already exists",
    );
    expect(sendMail).not.toHaveBeenCalled();

    const confirmationTokens = await AuthToken.find({
      userId: managerId,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
    }).select("+tokenHash");

    expect(confirmationTokens).toHaveLength(1);
    expect(confirmationTokens[0].tokenHash).toBe(hashAuthToken(rawToken));
  });

  it("rejects unauthorized actors and invalid User/Company source states", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "candidate.resend@example.com",
      role: USER_ROLE.CANDIDATE,
    });

    const draftRegistration = await agent
      .post("/api/auth/register/company-manager")
      .send({
        fullName: "Draft Manager",
        email: "manager.resend.draft@example.com",
        password: DEFAULT_PASSWORD,
      });

    expect(draftRegistration.status).toBe(201);

    const draftAccessToken = await loginAndGetAccessToken(agent, {
      email: "manager.resend.draft@example.com",
    });

    const draftResend = await agent
      .post("/api/company/resend-approval-confirmation")
      .set("Authorization", `Bearer ${draftAccessToken}`)
      .send();

    expect(draftResend.status).toBe(409);

    const pendingSubmitted = await registerSubmitAndApproveCompany(agent, {
      managerEmail: "manager.resend.pending@example.com",
      adminEmail: "admin.resend.pending@example.com",
      companyName: "Pending Resend Co",
      businessRegistrationNumber: "BRN-RESEND-PENDING",
    });

    await AuthToken.deleteMany({
      userId: pendingSubmitted.managerId,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
    });

    await Company.updateOne(
      { _id: pendingSubmitted.companyId },
      {
        approvalStatus: COMPANY_APPROVAL_STATUS.PENDING,
        reviewedByUserId: null,
        reviewedAt: null,
      },
    );

    const pendingResend = await agent
      .post("/api/company/resend-approval-confirmation")
      .set("Authorization", `Bearer ${pendingSubmitted.onboardingAccessToken}`)
      .send();

    expect(pendingResend.status).toBe(409);

    const candidateAccessToken = await loginAndGetAccessToken(agent, {
      email: "candidate.resend@example.com",
    });

    const candidateResend = await agent
      .post("/api/company/resend-approval-confirmation")
      .set("Authorization", `Bearer ${candidateAccessToken}`)
      .send();

    expect(candidateResend.status).toBe(403);

    const otherApproved = await registerSubmitAndApproveCompany(agent, {
      managerEmail: "manager.resend.other@example.com",
      adminEmail: "admin.resend.other@example.com",
      companyName: "Other Resend Co",
      businessRegistrationNumber: "BRN-RESEND-OTHER",
    });

    await AuthToken.updateOne(
      {
        userId: otherApproved.managerId,
        type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
      },
      { expiresAt: new Date(Date.now() - 1_000) },
    );

    const crossTenantResend = await agent
      .post("/api/company/resend-approval-confirmation")
      .set("Authorization", `Bearer ${pendingSubmitted.onboardingAccessToken}`)
      .send();

    expect(crossTenantResend.status).toBe(409);

    const otherTokens = await AuthToken.countDocuments({
      userId: otherApproved.managerId,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
      expiresAt: { $gt: new Date() },
    });

    expect(otherTokens).toBe(0);
  });

  it("replaces expired leftover tokens so only one usable confirmation remains", async () => {
    const agent = createTestAgent();

    const { managerId, onboardingAccessToken } =
      await registerSubmitAndApproveCompany(agent, {
        managerEmail: "manager.resend.invariant@example.com",
        adminEmail: "admin.resend.invariant@example.com",
        companyName: "Invariant Resend Co",
        businessRegistrationNumber: "BRN-RESEND-INVARIANT",
      });

    await AuthToken.updateOne(
      {
        userId: managerId,
        type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
      },
      { expiresAt: new Date(Date.now() - 5_000) },
    );

    const leftoverRawToken = generateAuthToken();

    await AuthToken.create({
      userId: managerId,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
      tokenHash: hashAuthToken(leftoverRawToken),
      expiresAt: new Date(Date.now() - 1_000),
    });

    expect(
      await AuthToken.countDocuments({
        userId: managerId,
        type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
      }),
    ).toBe(2);

    sendMail.mockClear();

    const response = await agent
      .post("/api/company/resend-approval-confirmation")
      .set("Authorization", `Bearer ${onboardingAccessToken}`)
      .send();

    expect(response.status).toBe(200);

    const confirmationTokens = await AuthToken.find({
      userId: managerId,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
    }).select("+tokenHash");

    expect(confirmationTokens).toHaveLength(1);
    expect(confirmationTokens[0].expiresAt.getTime()).toBeGreaterThan(
      Date.now(),
    );

    const newRawToken = extractConfirmationTokenFromMailCall(
      sendMail.mock.calls[0][0],
    );

    expect(confirmationTokens[0].tokenHash).toBe(hashAuthToken(newRawToken));
    expect(confirmationTokens[0].tokenHash).not.toBe(
      hashAuthToken(leftoverRawToken),
    );
  });

  it("does not leave a usable confirmation when post-create arbitration fails", async () => {
    const agent = createTestAgent();

    const { managerId } = await registerSubmitAndApproveCompany(agent, {
      managerEmail: "manager.resend.arbfail@example.com",
      adminEmail: "admin.resend.arbfail@example.com",
      companyName: "Arbitration Fail Co",
      businessRegistrationNumber: "BRN-RESEND-ARBFAIL",
    });

    await AuthToken.updateOne(
      {
        userId: managerId,
        type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
      },
      { expiresAt: new Date(Date.now() - 1_000) },
    );

    sendMail.mockClear();

    const originalFind = AuthToken.find.bind(AuthToken);
    let arbitrationLookups = 0;

    vi.spyOn(AuthToken, "find").mockImplementation((filter, ...rest) => {
      const isConfirmationLookup =
        filter?.type === AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION;

      if (isConfirmationLookup) {
        arbitrationLookups += 1;

        if (arbitrationLookups >= 1) {
          throw new Error("forced arbitration failure after token create");
        }
      }

      return originalFind(filter, ...rest);
    });

    await expect(
      resendApprovalConfirmation({ managerUserId: managerId }),
    ).rejects.toThrow(/forced arbitration failure/);

    AuthToken.find.mockRestore();

    const usableTokens = await AuthToken.countDocuments({
      userId: managerId,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
      expiresAt: { $gt: new Date() },
    });

    expect(usableTokens).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("does not leave a usable confirmation when mail fails after exclusive claim", async () => {
    const agent = createTestAgent();

    const { managerId } = await registerSubmitAndApproveCompany(agent, {
      managerEmail: "manager.resend.mailfail@example.com",
      adminEmail: "admin.resend.mailfail@example.com",
      companyName: "Mail Fail Resend Co",
      businessRegistrationNumber: "BRN-RESEND-MAILFAIL",
    });

    await AuthToken.updateOne(
      {
        userId: managerId,
        type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
      },
      { expiresAt: new Date(Date.now() - 1_000) },
    );

    sendMail.mockRejectedValueOnce(new Error("forced SMTP failure"));

    await expect(
      resendApprovalConfirmation({ managerUserId: managerId }),
    ).rejects.toMatchObject({
      statusCode: 503,
    });

    const usableTokens = await AuthToken.countDocuments({
      userId: managerId,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
      expiresAt: { $gt: new Date() },
    });

    expect(usableTokens).toBe(0);
  });

  it("does not leave a usable confirmation when mail-failure cleanup itself fails", async () => {
    const agent = createTestAgent();

    const { managerId } = await registerSubmitAndApproveCompany(agent, {
      managerEmail: "manager.resend.partialmail@example.com",
      adminEmail: "admin.resend.partialmail@example.com",
      companyName: "Partial Mail Cleanup Co",
      businessRegistrationNumber: "BRN-RESEND-PARTIALMAIL",
    });

    await AuthToken.updateOne(
      {
        userId: managerId,
        type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
      },
      { expiresAt: new Date(Date.now() - 1_000) },
    );

    sendMail.mockRejectedValueOnce(new Error("forced SMTP failure"));

    const deleteOneSpy = vi
      .spyOn(AuthToken, "deleteOne")
      .mockRejectedValueOnce(new Error("forced token cleanup failure"));

    await expect(
      resendApprovalConfirmation({ managerUserId: managerId }),
    ).rejects.toMatchObject({
      statusCode: 503,
    });

    deleteOneSpy.mockRestore();

    const usableTokens = await AuthToken.countDocuments({
      userId: managerId,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
      expiresAt: { $gt: new Date() },
    });

    expect(usableTokens).toBe(0);
  });

  it("allows only one concurrent resend to create a usable confirmation token", async () => {
    const agent = createTestAgent();

    const { companyId, managerId } = await registerSubmitAndApproveCompany(
      agent,
      {
        managerEmail: "manager.resend.concurrent@example.com",
        adminEmail: "admin.resend.concurrent@example.com",
        companyName: "Concurrent Resend Co",
        businessRegistrationNumber: "BRN-RESEND-CONCURRENT",
      },
    );

    const companyBefore = await Company.findById(companyId);
    const managerBefore = await User.findById(managerId);

    await AuthToken.updateOne(
      {
        userId: managerId,
        type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
      },
      { expiresAt: new Date(Date.now() - 1_000) },
    );

    sendMail.mockClear();

    const barrier = installUsableConfirmationReadBarrier();

    const firstResend = resendApprovalConfirmation({ managerUserId: managerId });
    const secondResend = resendApprovalConfirmation({
      managerUserId: managerId,
    });

    await barrier.awaitBothReads();
    barrier.releaseReads();

    const results = await Promise.allSettled([firstResend, secondResend]);
    AuthToken.findOne.mockRestore();

    const outcomes = results.map(settledServiceOutcome);
    const successes = outcomes.filter((outcome) => outcome.ok);
    const failures = outcomes.filter((outcome) => !outcome.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].statusCode).toBe(409);

    const usableTokens = await AuthToken.find({
      userId: managerId,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
      expiresAt: { $gt: new Date() },
    });
    const companyAfter = await Company.findById(companyId);
    const managerAfter = await User.findById(managerId);

    expect(usableTokens).toHaveLength(1);
    expect(managerAfter.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(managerAfter.emailVerifiedAt).toBeNull();
    expect(companyAfter.approvalStatus).toBe(COMPANY_APPROVAL_STATUS.APPROVED);
    expect(companyAfter.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(companyAfter.activatedAt).toBeNull();
    expect(companyAfter.reviewedByUserId.toString()).toBe(
      companyBefore.reviewedByUserId.toString(),
    );
    expect(companyAfter.reviewedAt.getTime()).toBe(
      companyBefore.reviewedAt.getTime(),
    );
    expect(managerBefore.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(sendMail).toHaveBeenCalledOnce();
  });
});
