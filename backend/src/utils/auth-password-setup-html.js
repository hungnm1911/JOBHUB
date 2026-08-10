const escapeHtmlAttribute = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/**
 * Minimal HTML form so email GET links can collect a password and POST
 * to the existing JSON/urlencoded auth completion endpoints.
 */
const buildAuthPasswordSetupHtml = ({
  title,
  actionPath,
  rawToken,
  submitLabel,
}) => {
  const action = `/api/auth/${String(actionPath).replace(/^\/+/, "")}`;
  const safeToken = escapeHtmlAttribute(rawToken);
  const safeTitle = escapeHtmlAttribute(title);
  const safeSubmitLabel = escapeHtmlAttribute(submitLabel);

  return (
    "<!DOCTYPE html>" +
    "<html lang=\"en\">" +
    "<head>" +
    `<meta charset="utf-8"/>` +
    `<title>${safeTitle}</title>` +
    "</head>" +
    "<body>" +
    `<h1>${safeTitle}</h1>` +
    `<form method="POST" action="${action}">` +
    `<input type="hidden" name="token" value="${safeToken}"/>` +
    '<label for="password">Password</label>' +
    '<input id="password" name="password" type="password" ' +
    'minlength="8" maxlength="64" required autocomplete="new-password"/>' +
    `<button type="submit">${safeSubmitLabel}</button>` +
    "</form>" +
    "</body>" +
    "</html>"
  );
};

export default buildAuthPasswordSetupHtml;
