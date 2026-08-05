import AppError from "../utils/app-error.js";

const notFound = (request, response, next) => {
  next(
    new AppError(
      404,
      `Route not found`,
    ),
  );
};

export default notFound;