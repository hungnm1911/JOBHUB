import { z } from "zod";
import AppError from "../utils/app-error.js";

const text = z.string().trim().min(1).max(100);
const schema = z.object({ employeeCode: text.optional(), jobTitle: text.optional() })
  .strict().refine((value) => Object.keys(value).length > 0, "Provide employeeCode or jobTitle");
const validateUpdateRecruiter = (request, _response, next) => {
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) return next(new AppError(400, parsed.error.issues[0].message));
  request.body = parsed.data;
  return next();
};
export default validateUpdateRecruiter;
