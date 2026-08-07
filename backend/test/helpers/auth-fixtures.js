import AUTH_TOKEN_TYPE from "../../src/constants/auth-token-type.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import config from "../../src/config/index.js";
import AuthSession from "../../src/models/auth-session.model.js";
import AuthToken from "../../src/models/auth-token.model.js";
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

export {
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
