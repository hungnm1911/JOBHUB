import { createHash, randomBytes } from "node:crypto";

const generateAuthToken = () => {
  return randomBytes(32).toString("hex");
};

const hashAuthToken = (token) => {
  return createHash("sha256").update(token).digest("hex");
};

export { generateAuthToken, hashAuthToken };
