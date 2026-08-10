import config from "../config/index.js";

/**
 * Build a browser-clickable auth action URL mounted under /api/auth.
 * Email clients issue GET with the token query parameter.
 */
const buildAuthActionUrl = (actionPath, rawToken) => {
  const normalizedPath = String(actionPath).replace(/^\/+/, "");

  return (
    `${config.appBaseUrl}/api/auth/${normalizedPath}` +
    `?token=${encodeURIComponent(rawToken)}`
  );
};

export default buildAuthActionUrl;
