import { randomUUID } from "node:crypto";

import config from "../config/index.js";
import HTTP_HEADER from "../constants/http-header.js";
import logger, { runWithRequestId } from "../utils/logger.js";

const TRUSTED_REQUEST_ID_PATTERN = /^[\w.:-]{1,128}$/;

const NANOSECONDS_PER_MILLISECOND = 1_000_000;

const responseProducerFromStack = () => new Error().stack?.split("\n")
  .find((line) => /\/backend\/(?:src|test)\//.test(line)
    && !line.includes("/node_modules/")
    && !line.includes("/middlewares/request-logger.js"))?.trim();

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

  let logged = false;
  let responseBody;
  let responseProducer;
  let representationStatusCode;
  let representationContentType;
  if (config.env === "development" && typeof response.send === "function") {
    const send = response.send;
    response.send = function sendAndRecord(body) {
      responseBody = body;
      responseProducer = responseProducerFromStack();
      representationStatusCode = response.statusCode;
      representationContentType = response.getHeader?.("content-type");
      if (logged && !response.writableFinished) {
        logger.warn("HTTP response generated after client disconnect", {
          requestId: request.id,
          method: request.method,
          path: requestPath,
          statusCode: response.statusCode,
          responseProducer,
          body,
        });
      }
      return send.call(this, body);
    };
  }

  const logCompletion = () => {
    if (logged) return;
    logged = true;
    const durationMs = Number(process.hrtime.bigint() - startedAt)
      / NANOSECONDS_PER_MILLISECOND;

    const aborted = !response.writableFinished;
    const context = {
      requestId: request.id,
      method: request.method,
      path: requestPath,
      statusCode: aborted ? null : response.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
      aborted,
      ...(responseProducer ? { responseProducer } : {}),
      ...(config.env === "development" && request.aiV05Diagnostic
        ? { checkpoint: request.aiV05Diagnostic } : {}),
    };

    if (aborted) {
      logger.warn("HTTP request aborted", context);
      return;
    }

    logger.info("HTTP request completed", context);
    if (config.env === "development") {
      const contentType = response.getHeader?.("content-type")
        ?? representationContentType;
      const bodySuppressed = request.method === "HEAD"
        || [204, 205, 304].includes(response.statusCode);
      let body = bodySuppressed ? null : responseBody;
      let representationBody = responseBody;
      if (typeof body === "string" && typeof contentType === "string"
        && contentType.includes("application/json")) {
        try { body = JSON.parse(body); } catch { /* log the original response */ }
      }
      if (response.statusCode === 304 && typeof representationBody === "string"
        && typeof contentType === "string" && contentType.includes("application/json")) {
        try { representationBody = JSON.parse(representationBody); }
        catch { /* log the original representation */ }
      }
      logger.debug("HTTP response", {
        requestId: request.id,
        statusCode: response.statusCode,
        contentType,
        body: Buffer.isBuffer(body) ? { binaryBytes: body.length } : body ?? null,
        ...(response.statusCode === 304 && Number.isInteger(representationStatusCode)
          && representationStatusCode !== 304
          ? { representationStatusCode,
            representationBody: Buffer.isBuffer(representationBody)
              ? { binaryBytes: representationBody.length } : representationBody } : {}),
        ...(responseProducer ? { responseProducer } : {}),
      });
    }
  };

  response.on("finish", logCompletion);
  response.on("close", logCompletion);

  runWithRequestId(request.id, next);
};

export default requestLogger;
