const testEnvironment = {
  NODE_ENV: "test",
  PORT: "8001",
  MONGODB_URI: "mongodb://127.0.0.1:27017/jobhub-test-placeholder",
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: "5000",
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "test-api-key",
  CLOUDINARY_API_SECRET: "test-api-secret",
  BYTES_PER_MEGABYTE: "1048576",
  MAX_FILE_SIZE_MB: "10",
  JWT_SECRET: "test-jwt-secret-with-enough-length",
  JWT_EXPIRES_IN: "15m",
  JWT_ALGORITHM: "HS256",
  JWT_INVITE_SECRET: "test-jwt-invite-secret-with-enough-length",
  JWT_INVITE_EXPIRES_IN: "24h",
  BCRYPT_SALT_ROUNDS: "4",
  ADMIN_EMAIL: "admin@example.com",
  ADMIN_PASSWORD: "admin-password",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
  SMTP_SECURE: "false",
  SMTP_USER: "smtp-user@example.com",
  SMTP_PASS: "smtp-password",
  MAIL_FROM_NAME: "JobHub Test",
  APP_BASE_URL: "http://localhost:8001",
  EMAIL_VERIFICATION_EXPIRES_IN_MS: "3600000",
  PASSWORD_RESET_EXPIRES_IN_MS: "3600000",
  AUTH_SESSION_EXPIRES_IN_MS: "604800000",
};

for (const [key, value] of Object.entries(testEnvironment)) {
  process.env[key] ??= value;
}
