import jsonwebtoken from "jsonwebtoken";

import config from "../config/index.js";
import TOKEN_TYPE from "../constants/token-type.js";

const algorithm = config.jwt.algorithm;
const expiresIn = config.jwt.expiresIn;
const secret = config.jwt.secret;
const inviteSecret = config.jwt.inviteSecret;
const inviteExpiresIn = config.jwt.inviteExpiresIn;

const generateAccessToken = ({ userId, role }) => {
  return jsonwebtoken.sign(
    {
      userId,
      role,
    },
    secret,
    {
      algorithm: algorithm,
      expiresIn: expiresIn
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

const generateInviteToken = ({ email }) => {
  return jsonwebtoken.sign(
    {
      email,
      type: TOKEN_TYPE.INVITE
    },
    inviteSecret,
    {
      algorithm: algorithm,
      expiresIn: inviteExpiresIn
    },
  );
}

const verifyInviteToken = (token) => {
  return jsonwebtoken.verify(
    token,
    inviteSecret,
    { algorithms: [algorithm] }
  );
}

export { 
  generateAccessToken, 
  verifyAccessToken,
  generateInviteToken,
  verifyInviteToken
};
