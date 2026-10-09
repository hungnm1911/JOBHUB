import multer from "multer";
import config from "../config/index.js";
import AppError from "../utils/app-error.js";
import logger from "../utils/logger.js";

// Express body parsers reject with http-errors that mark client-safe 4xx
// failures (malformed JSON, oversized payloads) as `expose`.
const isExposedClientHttpError = (error) => {
  return error?.expose === true
    && Number.isInteger(error.status)
    && error.status >= 400
    && error.status < 500;
};

const errorHandler = (error, request, response, _next) => {
  const isOperrationError = error instanceof AppError;
  const isMulterError = error instanceof multer.MulterError;

  let statusCode = 500;
  let message = "Internal server error";

  if (isOperrationError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (isMulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      statusCode = 413;
      message = `File size must not exceed ` + `${config.fileUpload.maxFileSizeMB} MB`;
    } else {
      statusCode = 400;
      message = error.message;
    }
  } else if (isExposedClientHttpError(error)) {
    statusCode = error.status;
    message = error.message;
  }

  const [requestPath] = request.originalUrl.split("?");
  const logContext = {
    requestId: request.id,
    request: `${request.method} ${requestPath}`,
    statusCode,
    error,
  };

  if (statusCode >= 500) {
    logger.error("Unhandled server error", logContext);
  } else {
    logger.debug(`Request rejected: ${message}`, logContext);
  }

  const responseBody = {
    error: {
      message,
    },
  };

  if (error.details) {
    responseBody.error.details = error.details;
  }

  if (config.env !== "production") {
    responseBody.error.stack = error.stack;
  }

  response.status(statusCode).json(responseBody);
};

export default errorHandler;
