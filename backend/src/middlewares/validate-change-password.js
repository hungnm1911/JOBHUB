import { z } from "zod";
import AppError from "../utils/app-error.js";

const schema = z.object({
  currentPassword: z.string().min(1).max(64),
  password: z.string().min(8).max(64),
}).strict();

const validateChangePassword = (request, _response, next) => {
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) return next(new AppError(400, parsed.error.issues[0].message));
  request.body = parsed.data;
  return next();
};
export default validateChangePassword;
