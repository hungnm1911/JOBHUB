import multer from "multer";
import config from "../config/index.js";
import AppError from "../utils/app-error.js";

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
  }

  if (statusCode === 500) {
    console.error("Unhandled server error:", error);
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