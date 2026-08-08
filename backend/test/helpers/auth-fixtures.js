import AUTH_TOKEN_TYPE from "../../src/constants/auth-token-type.js";
import COMPANY_APPROVAL_STATUS from "../../src/constants/company-approval-status.js";
import COMPANY_MEMBER_ROLE from "../../src/constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import config from "../../src/config/index.js";
import AuthSession from "../../src/models/auth-session.model.js";
import AuthToken from "../../src/models/auth-token.model.js";
import Company from "../../src/models/company.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import User from "../../src/models/user.model.js";
import { generateAuthToken, hashAuthToken } from "../../src/utils/hash-auth-token.js";
import { hashPassword } from "../../src/utils/hash-password.js";

const createUnverifiedUserWithVerificationToken = async ({
  email = "candidate@example.com",
  fullName = "Jane Candidate",
  status = USER_STATUS.ACTIVE,
  expiresAt = new Date(Date.now() + 3_600_000),
} = {}) => {
  const rawToken = generateAuthToken();
  const passwordHash = await hashPassword("password123");

  const user = await User.create({
    fullName,
    email,
    passwordHash,
    role: USER_ROLE.CANDIDATE,
    status,
    emailVerifiedAt: null,
    mustChangePassword: false,
  });

  await AuthToken.create({
    userId: user._id,
    type: AUTH_TOKEN_TYPE.EMAIL_VERIFICATION,
    tokenHash: hashAuthToken(rawToken),
    expiresAt,
  });

  return {
    rawToken,
    user,
  };
};

const DEFAULT_PASSWORD = "password123";

const createVerifiedUser = async ({
  email = "candidate@example.com",
  fullName = "Jane Candidate",
  password = DEFAULT_PASSWORD,
  role = USER_ROLE.CANDIDATE,
  status = USER_STATUS.ACTIVE,
} = {}) => {
  const passwordHash = await hashPassword(password);

  const user = await User.create({
    fullName,
    email,
    passwordHash,
    role,
    status,
    emailVerifiedAt: new Date(),
    mustChangePassword: false,
  });

  return {
    password,
    user,
  };
};

const createSessionWithRefreshToken = async (
  user,
  {
    expiresAt = new Date(Date.now() + config.authSession.expiresInMs),
  } = {},
) => {
  const rawRefreshToken = generateAuthToken();

  const session = await AuthSession.create({
    userId: user._id,
    refreshTokenHash: hashAuthToken(rawRefreshToken),
    expiresAt,
  });

  return {
    rawRefreshToken,
    session,
  };
};

const createPasswordResetToken = async (
  user,
  {
    expiresAt = new Date(Date.now() + config.authToken.passwordResetExpiresInMs),
  } = {},
) => {
  const rawToken = generateAuthToken();

  await AuthToken.create({
    userId: user._id,
    type: AUTH_TOKEN_TYPE.PASSWORD_RESET,
    tokenHash: hashAuthToken(rawToken),
    expiresAt,
  });

  return {
    rawToken,
  };
};

const createCompanyStaffWithMembership = async ({
  email = "manager@example.com",
  fullName = "Chris Manager",
  password = DEFAULT_PASSWORD,
  status = USER_STATUS.PENDING_ACTIVATION,
  emailVerifiedAt = null,
  mustChangePassword = false,
  company: companyFields = {},
  membershipRole = COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
  membershipStatus = COMPANY_MEMBER_STATUS.ACTIVE,
  employeeCode = null,
  jobTitle = null,
} = {}) => {
  const passwordHash = await hashPassword(password);

  const user = await User.create({
    fullName,
    email,
    passwordHash,
    role: USER_ROLE.COMPANY_STAFF,
    status,
    emailVerifiedAt,
    mustChangePassword,
  });

  const company = await Company.create({
    approvalStatus: COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
    operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
    ...companyFields,
  });

  const membershipFields = {
    userId: user._id,
    companyId: company._id,
    role: membershipRole,
    status: membershipStatus,
  };

  if (membershipRole === COMPANY_MEMBER_ROLE.RECRUITER) {
    membershipFields.employeeCode = employeeCode ?? "NV001";
    membershipFields.jobTitle = jobTitle ?? "Recruiter";
  }

  const membership = await CompanyMember.create(membershipFields);

  return {
    password,
    user,
    company,
    membership,
  };
};

const createApprovedActiveCompanyFields = ({
  name = "Acme Hiring",
  businessRegistrationNumber = "BRN-V3-AUTHZ-1",
  reviewedByUserId,
} = {}) => {
  const submittedAt = new Date("2026-01-01T00:00:00.000Z");
  const reviewedAt = new Date("2026-01-02T00:00:00.000Z");
  const activatedAt = new Date("2026-01-03T00:00:00.000Z");

  return {
    name,
    businessRegistrationNumber,
    description: "Approved active company for authorization tests",
    approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
    operationalStatus: COMPANY_OPERATIONAL_STATUS.ACTIVE,
    submittedAt,
    reviewedByUserId,
    reviewedAt,
    activatedAt,
    reviewSnapshot: {
      name,
      businessRegistrationNumber,
      description: "Approved active company for authorization tests",
    },
  };
};

const createActiveCompanyManagerContext = async ({
  email = "active.manager@example.com",
  fullName = "Active Manager",
  password = DEFAULT_PASSWORD,
  mustChangePassword = false,
  businessRegistrationNumber = "BRN-V3-CM-1",
  name = "Active Manager Co",
} = {}) => {
  const reviewedBy = await User.create({
    fullName: "Reviewer Admin",
    email: `reviewer.${email}`,
    passwordHash: await hashPassword(password),
    role: USER_ROLE.PLATFORM_ADMIN,
    status: USER_STATUS.ACTIVE,
    emailVerifiedAt: new Date(),
    mustChangePassword: false,
  });

  return createCompanyStaffWithMembership({
    email,
    fullName,
    password,
    status: USER_STATUS.ACTIVE,
    emailVerifiedAt: new Date(),
    mustChangePassword,
    company: createApprovedActiveCompanyFields({
      name,
      businessRegistrationNumber,
      reviewedByUserId: reviewedBy._id,
    }),
  });
};

const createActiveRecruiterContext = async ({
  email = "active.recruiter@example.com",
  fullName = "Active Recruiter",
  password = DEFAULT_PASSWORD,
  mustChangePassword = false,
  membershipStatus = COMPANY_MEMBER_STATUS.ACTIVE,
  company,
  employeeCode = "NV-R1",
  jobTitle = "Recruiter",
} = {}) => {
  let ownedCompany = company;

  if (!ownedCompany) {
    const managerContext = await createActiveCompanyManagerContext({
      email: `cm.for.${email}`,
      businessRegistrationNumber: `BRN-FOR-${email}`,
    });
    ownedCompany = managerContext.company;
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    fullName,
    email,
    passwordHash,
    role: USER_ROLE.COMPANY_STAFF,
    status: USER_STATUS.ACTIVE,
    emailVerifiedAt: new Date(),
    mustChangePassword,
  });

  const membership = await CompanyMember.create({
    userId: user._id,
    companyId: ownedCompany._id,
    role: COMPANY_MEMBER_ROLE.RECRUITER,
    status: membershipStatus,
    employeeCode,
    jobTitle,
  });

  return {
    password,
    user,
    company: ownedCompany,
    membership,
  };
};

export {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createApprovedActiveCompanyFields,
  createCompanyStaffWithMembership,
  createPasswordResetToken,
  createSessionWithRefreshToken,
  createUnverifiedUserWithVerificationToken,
  createVerifiedUser,
  DEFAULT_PASSWORD,
};

const loginAndGetAccessToken = async (
  agent,
  {
    email,
    password = DEFAULT_PASSWORD,
  },
) => {
  const response = await agent.post("/api/auth/login").send({
    email,
    password,
  });

  return response.body.accessToken;
};

export { loginAndGetAccessToken };
