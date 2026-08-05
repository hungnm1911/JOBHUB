import database from "./database.js";

const requiredEnvironmentVariables = [
];

for (const variableName of requiredEnvironmentVariables) {
  if (!process.env[variableName]) {
    throw new Error(
      `Missing required environment variable: ${variableName}`,
    );
  }
}

// application : 
const env = process.env.NODE_ENV || "development";
const PORT = Number(process.env.PORT) || 8000

if (!Number.isInteger(PORT) || PORT <= 0) {
  throw new Error("PORT must be a positive integer");
}

// bcrypt : 
const bcryptSaltRounds = Number(
  process.env.BCRYPT_SALT_ROUNDS || 10,
);

if (!Number.isInteger(bcryptSaltRounds) || bcryptSaltRounds <= 0) {
  throw new Error("BCRYPT_SALT_ROUNDS must be a positive integer");
}

const bcrypt = Object.freeze({
  saltRounds: bcryptSaltRounds,
});

// jwt : 
const jwt = Object.freeze({
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  algorithm: process.env.JWT_ALGORITHM || "HS256",
  inviteSecret: process.env.JWT_INVITE_SECRET,
  inviteExpiresIn: process.env.JWT_INVITE_EXPIRES_IN || "24h",
});

// admin : 
const admin = {
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
};

// smtp :
const smtpPort = Number(process.env.SMTP_PORT || 587);

if (!Number.isInteger(smtpPort) || smtpPort <= 0) {
  throw new Error("SMTP_PORT must be a positive integer");
}

const smtpSecure = process.env.SMTP_SECURE === "true";

const smtp = Object.freeze({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpSecure,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  fromName: process.env.MAIL_FROM_NAME || "JobHub Admin",
});

export default Object.freeze({
  env,
  port: PORT,
  database,
  jwt,
  bcrypt,
  admin,
  smtp
});