class AppError extends Error {
  constructor(statusCode, message, details = null, { cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });

    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
