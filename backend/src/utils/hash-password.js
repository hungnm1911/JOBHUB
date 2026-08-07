import bcrypt from "bcryptjs";

import config from "../config/index.js";

const hashPassword = async (password) => {
  return bcrypt.hash(password, config.bcrypt.saltRounds);
};

const verifyPassword = async (password, passwordHash) => {
  return bcrypt.compare(password, passwordHash);
};

export { hashPassword, verifyPassword };
