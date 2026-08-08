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

import AUTH_TOKEN_TYPE from "../../src/constants/auth-token-type.js";
import COMPANY_MEMBER_ROLE from "../../src/constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import AuthToken from "../../src/models/auth-token.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import User from "../../src/models/user.model.js";
import sendMail from "../../src/services/mail.service.js";
import { createRecruiter } from "../../src/services/recruiter.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
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

const extractActivationTokenFromMailCall = (mailCall) => {
  const match = mailCall.html.match(/activate-recruiter\?token=([^"]+)/);

  return decodeURIComponent(match[1]);
};

describe("V3 Slice 03 Recruiter creation and activation issuance", () => {
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

  it("creates Recruiter User + RECRUITER membership atomically and issues activation email (F03/F04/TX-01)", async () => {
    const agent = createTestAgent();
    const { user: manager, company } = await createActiveCompanyManagerContext({
      email: "cm.create-recruiter@example.com",
      businessRegistrationNumber: "BRN-V3-R-CREATE-1",
    });
    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post("/api/company/recruiters")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "Riley Recruiter",
        email: "riley.recruiter@example.com",
        employeeCode: "NV-100",
        jobTitle: "Talent Partner",
      });

    expect(response.status).toBe(201);
    expect(response.body.recruiter).toMatchObject({
      fullName: "Riley Recruiter",
      email: "riley.recruiter@example.com",
      role: USER_ROLE.COMPANY_STAFF,
      status: USER_STATUS.ACTIVE,
      emailVerifiedAt: null,
      mustChangePassword: true,
      membership: {
        companyId: company._id.toString(),
        role: COMPANY_MEMBER_ROLE.RECRUITER,
        status: COMPANY_MEMBER_STATUS.ACTIVE,
        employeeCode: "NV-100",
        jobTitle: "Talent Partner",
      },
    });
    expect(response.body.recruiter.password).toBeUndefined();
    expect(response.body.recruiter.passwordHash).toBeUndefined();
    expect(response.body).not.toHaveProperty("token");
    expect(JSON.stringify(response.body)).not.toMatch(/activate-recruiter\?token=/);

    const persistedUser = await User.findById(response.body.recruiter.id).select(
      "+passwordHash",
    );
    const persistedMembership = await CompanyMember.findOne({
      userId: persistedUser._id,
    });
    const activationToken = await AuthToken.findOne({
      userId: persistedUser._id,
      type: AUTH_TOKEN_TYPE.RECRUITER_ACTIVATION,
    }).select("+tokenHash");

    expect(persistedUser.role).toBe(USER_ROLE.COMPANY_STAFF);
    expect(persistedUser.status).toBe(USER_STATUS.ACTIVE);
    expect(persistedUser.mustChangePassword).toBe(true);
    expect(persistedUser.passwordHash).toEqual(expect.any(String));
    expect(persistedMembership).toMatchObject({
      role: COMPANY_MEMBER_ROLE.RECRUITER,
      status: COMPANY_MEMBER_STATUS.ACTIVE,
      employeeCode: "NV-100",
      jobTitle: "Talent Partner",
    });
    expect(persistedMembership.companyId.toString()).toBe(company._id.toString());
    expect(activationToken).not.toBeNull();
    expect(activationToken.tokenHash).toEqual(expect.any(String));

    expect(sendMail).toHaveBeenCalledTimes(1);
    const mailCall = sendMail.mock.calls[0][0];
    expect(mailCall.to).toBe("riley.recruiter@example.com");
    expect(mailCall.html).toMatch(/activate-recruiter\?token=/);
    expect(mailCall.text.toLowerCase()).not.toMatch(/passwordHash|password\s*=/i);
    expect(mailCall.html).not.toMatch(persistedUser.passwordHash);

    const rawToken = extractActivationTokenFromMailCall(mailCall);
    expect(rawToken).toEqual(expect.any(String));
    expect(JSON.stringify(activationToken.toObject())).not.toContain(rawToken);
  });

  it("rejects duplicate email system-wide and duplicate employeeCode in tenant (BR-01/BR-09)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.dup@example.com",
      businessRegistrationNumber: "BRN-V3-R-DUP-1",
    });
    await createActiveRecruiterContext({
      email: "existing.recruiter@example.com",
      company: manager.company,
      employeeCode: "NV-DUP",
    });
    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const duplicateEmail = await agent
      .post("/api/company/recruiters")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "Dup Email",
        email: "existing.recruiter@example.com",
        employeeCode: "NV-NEW",
        jobTitle: "Recruiter",
      });

    expect(duplicateEmail.status).toBe(409);
    expect(duplicateEmail.body.error.message).toMatch(/email/i);

    const duplicateCode = await agent
      .post("/api/company/recruiters")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "Dup Code",
        email: "new.recruiter@example.com",
        employeeCode: "NV-DUP",
        jobTitle: "Recruiter",
      });

    expect(duplicateCode.status).toBe(409);
    expect(duplicateCode.body.error.message).toMatch(/employee code/i);
  });

  it("rejects missing required fields and password/companyId in body (BR-08/BR-12/BR-07)", async () => {
    const agent = createTestAgent();
    const { user: manager } = await createActiveCompanyManagerContext({
      email: "cm.validation@example.com",
      businessRegistrationNumber: "BRN-V3-R-VAL-1",
    });
    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.email,
      password: DEFAULT_PASSWORD,
    });

    const missing = await agent
      .post("/api/company/recruiters")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "Missing Fields",
        email: "missing.fields@example.com",
      });

    expect(missing.status).toBe(400);

    const withPassword = await agent
      .post("/api/company/recruiters")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "With Password",
        email: "with.password@example.com",
        employeeCode: "NV-PW",
        jobTitle: "Recruiter",
        password: "secretpassword",
      });

    expect(withPassword.status).toBe(400);

    const withForeignCompany = await agent
      .post(
        `/api/company/recruiters?companyId=${new mongoose.Types.ObjectId().toString()}`,
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "Foreign Tenant",
        email: "foreign.tenant@example.com",
        employeeCode: "NV-FT",
        jobTitle: "Recruiter",
      });

    expect(withForeignCompany.status).toBe(403);
    expect(withForeignCompany.body.error.message).toMatch(
      /not an authorization source/i,
    );
  });

  it("rejects Recruiter actor from creating another Recruiter (BR-05/BR-24)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.peer-guard@example.com",
      businessRegistrationNumber: "BRN-V3-R-PEER-1",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "peer.recruiter@example.com",
      company: manager.company,
      employeeCode: "NV-PEER",
      mustChangePassword: false,
    });
    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post("/api/company/recruiters")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "Should Fail",
        email: "should.fail@example.com",
        employeeCode: "NV-FAIL",
        jobTitle: "Recruiter",
      });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/Company Manager access required/i);
  });

  it("keeps Recruiter identity and membership history fields after creation (F16 foundation)", async () => {
    const { user: manager } = await createActiveCompanyManagerContext({
      email: "cm.history@example.com",
      businessRegistrationNumber: "BRN-V3-R-HIST-1",
    });

    const recruiter = await createRecruiter({
      managerUser: manager,
      fullName: "History Recruiter",
      email: "history.recruiter@example.com",
      employeeCode: "NV-HIST",
      jobTitle: "Sourcer",
    });

    const user = await User.findById(recruiter.id);
    const membership = await CompanyMember.findById(recruiter.membership.id);

    expect(user).not.toBeNull();
    expect(membership).not.toBeNull();
    expect(user.fullName).toBe("History Recruiter");
    expect(membership.employeeCode).toBe("NV-HIST");
    expect(membership.jobTitle).toBe("Sourcer");
    expect(membership.companyId.toString()).toBe(recruiter.membership.companyId);
  });

  it("rolls back TX-01 when membership create fails so orphan User is not left", async () => {
    const { user: manager, company } = await createActiveCompanyManagerContext({
      email: "cm.tx-rollback@example.com",
      businessRegistrationNumber: "BRN-V3-R-TX-1",
    });

    const createSpy = vi
      .spyOn(CompanyMember, "create")
      .mockRejectedValueOnce(new Error("forced membership failure"));

    await expect(
      createRecruiter({
        managerUser: manager,
        fullName: "Rollback Recruiter",
        email: "rollback.recruiter@example.com",
        employeeCode: "NV-RB",
        jobTitle: "Recruiter",
      }),
    ).rejects.toThrow(/forced membership failure/i);

    createSpy.mockRestore();

    expect(
      await User.findOne({ email: "rollback.recruiter@example.com" }),
    ).toBeNull();
    expect(
      await CompanyMember.findOne({
        companyId: company._id,
        employeeCode: "NV-RB",
      }),
    ).toBeNull();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("keeps TX-01 Recruiter when activation email delivery fails (F04 outside TX)", async () => {
    sendMail.mockRejectedValueOnce(new Error("SMTP down"));

    const { user: manager } = await createActiveCompanyManagerContext({
      email: "cm.mail-fail@example.com",
      businessRegistrationNumber: "BRN-V3-R-MAIL-1",
    });

    await expect(
      createRecruiter({
        managerUser: manager,
        fullName: "Mail Fail Recruiter",
        email: "mail.fail.recruiter@example.com",
        employeeCode: "NV-MF",
        jobTitle: "Recruiter",
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringMatching(/activation email/i),
    });

    const user = await User.findOne({
      email: "mail.fail.recruiter@example.com",
    });
    const membership = await CompanyMember.findOne({ userId: user._id });
    const token = await AuthToken.findOne({
      userId: user._id,
      type: AUTH_TOKEN_TYPE.RECRUITER_ACTIVATION,
    });

    expect(user).not.toBeNull();
    expect(membership.role).toBe(COMPANY_MEMBER_ROLE.RECRUITER);
    expect(token).not.toBeNull();
  });

  it("blocks terminated-user email reuse (BR-20)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.terminated-email@example.com",
      businessRegistrationNumber: "BRN-V3-R-TERM-1",
    });
    const terminated = await createActiveRecruiterContext({
      email: "terminated.email@example.com",
      company: manager.company,
      employeeCode: "NV-TERM",
    });
    terminated.user.status = USER_STATUS.TERMINATED;
    await terminated.user.save();

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post("/api/company/recruiters")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "Reuse Attempt",
        email: "terminated.email@example.com",
        employeeCode: "NV-REUSE",
        jobTitle: "Recruiter",
      });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/email/i);
  });
});
