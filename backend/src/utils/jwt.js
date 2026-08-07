import jsonwebtoken from "jsonwebtoken";

import config from "../config/index.js";

const algorithm = config.jwt.algorithm;
const expiresIn = config.jwt.expiresIn;
const secret = config.jwt.secret;

const generateAccessToken = ({ userId, role, sessionId }) => {
  return jsonwebtoken.sign(
    {
      userId,
      role,
      sessionId,
    },
    secret,
    {
      algorithm: algorithm,
      expiresIn: expiresIn,
    },
  );
};

const verifyAccessToken = (token) => {
  return jsonwebtoken.verify(
    token, 
    secret,
    { algorithms: [algorithm] }
  );
}

export { 
  generateAccessToken, 
  verifyAccessToken
};
