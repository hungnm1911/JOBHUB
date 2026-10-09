import { randomUUID } from "node:crypto";

import HTTP_HEADER from "../constants/http-header.js";
import logger from "../utils/logger.js";

const TRUSTED_REQUEST_ID_PATTERN = /^[\w.:-]{1,128}$/;

const NANOSECONDS_PER_MILLISECOND = 1_000_000;

const resolveRequestId = (request) => {
  const incomingRequestId = request.get(HTTP_HEADER.REQUEST_ID);

  return incomingRequestId && TRUSTED_REQUEST_ID_PATTERN.test(incomingRequestId)
    ? incomingRequestId
    : randomUUID();
};

const requestLogger = (request, response, next) => {
  const startedAt = process.hrtime.bigint();
  // Query strings are omitted because auth action links carry raw tokens.
  const [requestPath] = request.originalUrl.split("?");

  request.id = resolveRequestId(request);
  response.set(HTTP_HEADER.REQUEST_ID, request.id);

  response.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt)
      / NANOSECONDS_PER_MILLISECOND;

    logger.debug(
      `${request.method} ${requestPath} `
        + `${response.statusCode} ${durationMs.toFixed(1)}ms`,
      { requestId: request.id },
    );
  });

  next();
};

export default requestLogger;
