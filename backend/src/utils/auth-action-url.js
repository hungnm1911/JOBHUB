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

/**
 * Build a link to a frontend screen that consumes the token through the API.
 * The path is resolved from the FRONTEND_BASE_URL origin.
 */
const buildFrontendActionUrlFromBase = (frontendBaseUrl, screenPath, rawToken) => {
  const normalizedPath = String(screenPath).replace(/^\/+/, "");
  const url = new URL(`/${normalizedPath}`, frontendBaseUrl);

  url.searchParams.set("token", String(rawToken));

  return url.href;
};

const buildFrontendActionUrl = (screenPath, rawToken) =>
  buildFrontendActionUrlFromBase(config.frontendBaseUrl, screenPath, rawToken);

export {
  buildAuthActionUrlFromBase,
  buildFrontendActionUrl,
  buildFrontendActionUrlFromBase,
};
export default buildAuthActionUrl;
