import config from "../config/index.js";

const buildRecruiterActivationEmail = ({ fullName, companyName, rawToken }) => {
  const activationUrl =
    `${config.appBaseUrl}/activate-recruiter?token=${encodeURIComponent(rawToken)}`;

  const subject = "Activate your JOBHUB recruiter account";
  const text =
    `Hello ${fullName},\n\n` +
    `You have been added as a recruiter for "${companyName}". ` +
    "Open the link below to activate your account and set your password:\n\n" +
    `${activationUrl}\n\n` +
    "This link expires and can only be used once.\n" +
    "Do not share this link. Your company manager does not receive your password.\n";

  const html =
    `<p>Hello ${fullName},</p>` +
    `<p>You have been added as a recruiter for &quot;${companyName}&quot;. ` +
    "Open the link below to activate your account and set your password:</p>" +
    `<p><a href="${activationUrl}">Activate recruiter account</a></p>` +
    "<p>This link expires and can only be used once.</p>" +
    "<p>Do not share this link. Your company manager does not receive your password.</p>";

  return { subject, text, html };
};

export default buildRecruiterActivationEmail;
