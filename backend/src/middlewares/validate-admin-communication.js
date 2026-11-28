import AppError from "../utils/app-error.js";

const validateCommunicationBody = (fields) => (request, _response, next) => {
  const body = request.body;
  if (!body || typeof body !== "object" || Array.isArray(body))
    return next(new AppError(400, "Invalid request body"));
  for (const key of Object.keys(body)) {
    if (!fields.includes(key))
      return next(
        new AppError(400, "Unsupported request field", { field: key }),
      );
  }
  for (const key of fields) {
    const value = body[key];
    const max = key === "title" ? 160 : key === "clientRequestId" ? 80 : 4000;
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.trim().length > max ||
      (key === "clientRequestId" && !/^[a-zA-Z0-9_-]+$/.test(value))
    )
      return next(new AppError(400, `Invalid ${key}`, { field: key }));
    body[key] = value.trim();
  }
  return next();
};
export { validateCommunicationBody };
