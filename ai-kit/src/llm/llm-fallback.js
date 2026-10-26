const FALLBACK_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);
const FAILURE_POLICIES = new Set(["provider-availability", "ai-v06"]);

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

const classifyPrimaryFailure = (error, failurePolicy) => {
  if (failurePolicy === "ai-v06" && error?.code === "INVALID_OPTIMIZATION_RESULT"
    && error?.name === "OptimizationResultError") {
    return { shouldFallback: true, status: null };
  }
  const errorChain = getErrorChain(error);
  const status = getHttpStatus(errorChain);

  if (status !== undefined) {
    return {
      shouldFallback: FALLBACK_HTTP_STATUSES.has(status)
        || (failurePolicy === "ai-v06" && status === 408),
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

const assertProviderChain = (providers) => {
  if (!Array.isArray(providers) || providers.length === 0) {
    throw new TypeError("providers must be a non-empty array");
  }

  providers.forEach((provider, index) => {
    if (!provider || typeof provider !== "object" || Array.isArray(provider)) {
      throw new TypeError(`providers[${index}] must be an object`);
    }

    if (typeof provider.name !== "string" || provider.name.trim().length === 0) {
      throw new TypeError(`providers[${index}].name must be a non-empty string`);
    }

    assertFunction(provider.execute, `providers[${index}].execute`);

    if (!Number.isInteger(provider.maxAttempts) || provider.maxAttempts < 1) {
      throw new TypeError(`providers[${index}].maxAttempts must be a positive integer`);
    }
  });
};

async function executeWithLlmProviderChain({ providers, logger,
  failurePolicy = "provider-availability" } = {}) {
  assertProviderChain(providers);
  assertLogger(logger);
  if (!FAILURE_POLICIES.has(failurePolicy)) {
    throw new TypeError("failurePolicy must be provider-availability or ai-v06");
  }

  for (let providerIndex = 0; providerIndex < providers.length; providerIndex += 1) {
    const provider = providers[providerIndex];

    for (let attempt = 1; attempt <= provider.maxAttempts; attempt += 1) {
      try {
        const result = await provider.execute();

        if (providerIndex > 0) {
          logger.info("LLM provider fallback succeeded", {
            provider: provider.name,
            attempt,
          });
        }

        return result;
      } catch (error) {
        const { shouldFallback, status } = classifyPrimaryFailure(error, failurePolicy);
        const canRetry = shouldFallback && attempt < provider.maxAttempts;
        const fallback = providers[providerIndex + 1];

        logger.warn("LLM provider attempt failed", {
          provider: provider.name,
          attempt,
          status,
        });

        if (canRetry) {
          logger.info("LLM provider retry attempted", {
            provider: provider.name,
            nextAttempt: attempt + 1,
            status,
          });
          continue;
        }

        if (shouldFallback && fallback) {
          logger.info("LLM provider fallback attempted", {
            fromProvider: provider.name,
            toProvider: fallback.name,
            status,
          });
          break;
        }

        logger.error("LLM provider chain failed", {
          provider: provider.name,
          attempt,
          status,
        });
        throw error;
      }
    }
  }

  throw new Error("LLM provider chain exhausted without a result");
}

async function executeWithLlmFallback({ primary, fallback, logger } = {}) {
  assertFunction(primary, "primary");
  assertFunction(fallback, "fallback");

  return executeWithLlmProviderChain({
    providers: [
      { name: "primary", execute: primary, maxAttempts: 1 },
      { name: "fallback", execute: fallback, maxAttempts: 1 },
    ],
    logger,
  });
}

export { executeWithLlmFallback, executeWithLlmProviderChain };
