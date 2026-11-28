import transporter from "../config/mailer.js";
import config from "../config/index.js";

const sendMail = async ({to, subject, text, html}) => {
  return transporter.sendMail({
    from: `"${config.smtp.fromName}" <${config.smtp.fromAddress}>`,
    to,
    subject,
    text,
    html,
  });
};
export default sendMail;
