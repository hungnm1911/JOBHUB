import config from "../config/index.js";
import AppError from "../utils/app-error.js";

const errorHandler = (error, request, response, _next) => {
  const isOperrationError = error instanceof AppError;

  const statusCode = isOperrationError
    ? error.statusCode
    : 500;

  if (statusCode === 500) {
    console.error("Unhandled server error:", error);
  }

  const responseBody = {
    error: {
      message: isOperrationError
        ? error.message
        : "Internal server error",
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