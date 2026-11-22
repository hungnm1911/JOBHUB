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

const MAX_CAUSE_DEPTH = 5;
const MAX_STACK_FRAMES = 20;
const SAFE_CODE = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const STACK_FRAME = /^\s*at\s+(?:.*?\()?((?:(?:file:\/\/)?\/[^()\s?#]+|node:[\w/.-]+):\d+:\d+)\)?\s*$/;

// Error messages, the first stack line, and provider payloads can contain CV/JD
// data. Keep only source locations from stack frames for runtime diagnosis.
const safeErrorContext = (error) => {
  const seen = new Set();
  const chain = [];
  let current = error;

  while (current instanceof Error && chain.length < MAX_CAUSE_DEPTH && !seen.has(current)) {
    seen.add(current);
    const frames = typeof current.stack === "string"
      ? current.stack.split("\n").slice(1)
        .map((line) => line.match(STACK_FRAME)?.[1])
        .filter(Boolean).slice(0, MAX_STACK_FRAMES)
      : [];
    const name = current.constructor?.name;
    const code = typeof current.code === "string" && SAFE_CODE.test(current.code)
      ? current.code
      : Number.isSafeInteger(current.code) ? String(current.code) : null;

    chain.push({
      errorType: typeof name === "string" && SAFE_CODE.test(name) ? name : "Error",
      errorCode: code,
      upstreamStatus: Number.isInteger(current.status) && current.status >= 100
        && current.status <= 599 ? current.status : null,
      stack: frames,
    });
    current = current.cause;
  }

  return chain;
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
  const errorChain = safeErrorContext(error);
  const logContext = {
    requestId: request.id,
    request: `${request.method} ${requestPath}`,
    statusCode,
    httpStatus: statusCode,
    upstreamStatus: errorChain.find(({ upstreamStatus }) => upstreamStatus !== null)
      ?.upstreamStatus ?? null,
    errorCode: errorChain.find(({ errorCode: code }) => code !== null)?.errorCode ?? null,
    errorType: errorChain[0]?.errorType ?? "UnknownError",
    stack: errorChain[0]?.stack ?? [],
    causes: errorChain.slice(1),
    ...(config.env === "development" ? { error } : {}),
  };

  if (statusCode >= 500) {
    logger.error("Unhandled server error", logContext);
  } else {
    logger.warn("Request rejected", logContext);
  }

  const responseBody = {
    error: {
      message,
    },
  };

  if (error.details) {
    responseBody.error.details = error.details;
  }

  if (config.env === "development" && request.aiV05Diagnostic) {
    responseBody.error.diagnostic = request.aiV05Diagnostic;
  } else if (config.env !== "production") {
    responseBody.error.stack = error.stack;
  }

  response.status(statusCode).json(responseBody);
};

export default errorHandler;
