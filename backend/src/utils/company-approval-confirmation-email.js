import buildAuthActionUrl from "./auth-action-url.js";

const buildCompanyApprovalConfirmationEmail = ({
  fullName,
  companyName,
  rawToken,
}) => {
  const confirmationUrl = buildAuthActionUrl(
    "confirm-company-approval",
    rawToken,
  );

  const subject = "Confirm your JOBHUB company approval";
  const text =
    `Hello ${fullName},\n\n` +
    `Your company "${companyName}" has been approved. ` +
    "Open the link below to confirm and complete activation:\n\n" +
    `${confirmationUrl}\n\n` +
    "This link expires and can only be used once.\n";

  const html =
    `<p>Hello ${fullName},</p>` +
    `<p>Your company &quot;${companyName}&quot; has been approved. ` +
    "Open the link below to confirm and complete activation:</p>" +
    `<p><a href="${confirmationUrl}">Confirm company approval</a></p>` +
    "<p>This link expires and can only be used once.</p>";

  return { subject, text, html };
};

export default buildCompanyApprovalConfirmationEmail;
