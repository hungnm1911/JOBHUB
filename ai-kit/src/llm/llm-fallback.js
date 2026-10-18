const FALLBACK_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);

const NETWORK_ERROR_CODES = new Set([
  "EAI_AGAIN",
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

const NETWORK_ERROR_NAMES = new Set([
  "APIConnectionError",
  "APIConnectionTimeoutError",
  "BodyTimeoutError",
  "ConnectionError",
  "ConnectTimeoutError",
  "HeadersTimeoutError",
  "RequestTimeoutError",
  "TimeoutError",
]);

const isObjectLike = (value) => {
  return value !== null && (typeof value === "object" || typeof value === "function");
};

const getErrorChain = (error) => {
  const chain = [];
  const visited = new Set();
  let current = error;

  while (isObjectLike(current) && !visited.has(current)) {
    chain.push(current);
    visited.add(current);
    current = current.cause;
  }

  return chain;
};

const normalizeHttpStatus = (value) => {
  if (Number.isInteger(value) && value >= 100 && value <= 599) {
    return value;
  }

  if (typeof value === "string" && /^\d{3}$/.test(value)) {
    const status = Number(value);

    if (status >= 100 && status <= 599) {
      return status;
    }
  }

  return undefined;
};

const getHttpStatus = (errorChain) => {
  for (const error of errorChain) {
    const statusCandidates = [
      error.status,
      error.statusCode,
      error.response?.status,
      error.response?.statusCode,
    ];

    for (const candidate of statusCandidates) {
      const status = normalizeHttpStatus(candidate);

      if (status !== undefined) {
        return status;
      }
    }
  }

  return undefined;
};

const hasHttpResponse = (errorChain) => {
  return errorChain.some((error) => error.response != null);
};

const isNetworkOrTimeoutError = (errorChain) => {
  if (hasHttpResponse(errorChain)) {
    return false;
  }

  return errorChain.some((error) => {
    return NETWORK_ERROR_NAMES.has(error.name)
      || NETWORK_ERROR_CODES.has(error.code)
      || NETWORK_ERROR_CODES.has(error.errno);
  });
};

const classifyPrimaryFailure = (error) => {
  const errorChain = getErrorChain(error);
  const status = getHttpStatus(errorChain);

  if (status !== undefined) {
    return {
      shouldFallback: FALLBACK_HTTP_STATUSES.has(status),
      status,
    };
  }

  return {
    shouldFallback: isNetworkOrTimeoutError(errorChain),
    status: null,
  };
};

const assertFunction = (value, fieldName) => {
  if (typeof value !== "function") {
    throw new TypeError(`${fieldName} must be a function`);
  }
};

const assertLogger = (logger) => {
  const hasLoggerContract = logger
    && ["error", "info", "warn"].every(
      (method) => typeof logger[method] === "function",
    );

  if (!hasLoggerContract) {
    throw new TypeError("logger must provide error, info, and warn methods");
  }
};

async function executeWithLlmFallback({ primary, fallback, logger } = {}) {
  assertFunction(primary, "primary");
  assertFunction(fallback, "fallback");
  assertLogger(logger);

  try {
    return await primary();
  } catch (primaryError) {
    const { shouldFallback, status } = classifyPrimaryFailure(primaryError);

    logger.warn("Primary LLM provider failed", { status });

    if (!shouldFallback) {
      throw primaryError;
    }

    logger.info("LLM fallback attempted", { status });

    try {
      const result = await fallback();

      logger.info("LLM fallback succeeded", { status });

      return result;
    } catch (fallbackError) {
      const fallbackStatus = getHttpStatus(getErrorChain(fallbackError)) ?? null;

      logger.error("LLM fallback failed", { fallbackStatus, status });

      throw fallbackError;
    }
  }
}

export { executeWithLlmFallback };
