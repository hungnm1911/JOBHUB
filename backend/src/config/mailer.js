import nodemailer from "nodemailer";

import config from "./index.js";

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,

  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

export default transporter;