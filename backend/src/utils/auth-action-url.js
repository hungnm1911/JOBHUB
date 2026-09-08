import config from "../config/index.js";

/**
 * Build a browser-clickable auth action URL mounted under /api/auth.
 * Email clients issue GET with the token query parameter.
 *
 * Uses an absolute `/api/auth/...` path against APP_BASE_URL so the mount
 * prefix is never doubled when the base accidentally includes `/api`.
 */
const buildAuthActionUrlFromBase = (appBaseUrl, actionPath, rawToken) => {
  const normalizedPath = String(actionPath).replace(/^\/+/, "");
  const url = new URL(`/api/auth/${normalizedPath}`, appBaseUrl);

  url.searchParams.set("token", String(rawToken));

  return url.href;
};

const buildAuthActionUrl = (actionPath, rawToken) =>
  buildAuthActionUrlFromBase(config.appBaseUrl, actionPath, rawToken);

export { buildAuthActionUrlFromBase };
export default buildAuthActionUrl;
