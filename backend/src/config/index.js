const requiredEnvironmentVariables = [
  "NODE_ENV",
  "PORT",
  "MONGODB_URI",
  "MONGODB_SERVER_SELECTION_TIMEOUT_MS",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "BYTES_PER_MEGABYTE",
  "MAX_FILE_SIZE_MB",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "JWT_ALGORITHM",
  "JWT_INVITE_SECRET",
  "JWT_INVITE_EXPIRES_IN",
  "BCRYPT_SALT_ROUNDS",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "MAIL_FROM_NAME",
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

// database :
const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error(
    "Missing required environment variable: MONGODB_URI",
  );
}

const serverSelectionTimeoutMS = Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS|| 10000);

if (!Number.isInteger(serverSelectionTimeoutMS)|| serverSelectionTimeoutMS <= 0) {
  throw new Error(
    "MONGODB_SERVER_SELECTION_TIMEOUT_MS must be a positive integer",
  );
}

const database = Object.freeze({
  uri,
  serverSelectionTimeoutMS,
});

// cloudinary:
const cloudinary = Object.freeze({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
});

// file upload:
const maxFileSizeMB = Number(
  process.env.MAX_FILE_SIZE_MB,
);

const bytesPerMegabyte = Number(
  process.env.BYTES_PER_MEGABYTE,
);

if (
  !Number.isInteger(maxFileSizeMB) ||
  maxFileSizeMB <= 0
) {
  throw new Error(
    "MAX_FILE_SIZE_MB must be a positive integer",
  );
}

if (
  !Number.isInteger(bytesPerMegabyte) ||
  bytesPerMegabyte <= 0
) {
  throw new Error(
    "BYTES_PER_MEGABYTE must be a positive integer",
  );
}

const fileUpload = Object.freeze({
  maxFileSizeMB,
  bytesPerMegabyte,
});

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
  cloudinary,
  jwt,
  bcrypt,
  admin,
  smtp,
  fileUpload
});