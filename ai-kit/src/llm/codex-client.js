import OpenAI from "openai";

import { logProviderUsage } from "./provider-usage.js";
import { getProviderErrorMetadata } from "./provider-error-metadata.js";

const assertNonEmptyString = (value, fieldName) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }
};

const SAFE_MESSAGES = new Set([
  "Connection error.", "Request timed out.", "Request was aborted.",
  "fetch failed", "socket hang up", "unable to verify the first certificate",
  "self-signed certificate in certificate chain",
]);
const NETWORK_CODES = new Set([
  "ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND",
  "ETIMEDOUT", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET", "CERT_HAS_EXPIRED", "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

const safeName = (value) => typeof value === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value)
  ? value : "UnknownError";
const tokenCount = (value) => Number.isInteger(value) && value >= 0 ? value : null;
const safeResponseValue = (value, allowed) => allowed.includes(value) ? value : "UNKNOWN";

const summarizeResponse = (response, requestMaxOutputTokens) => {
  const output = Array.isArray(response?.output) ? response.output : null;
  const content = output?.flatMap((item) => Array.isArray(item?.content) ? item.content : []) ?? [];
  return {
    gate: "responses_api",
    status: "OBSERVED",
    responseStatus: safeResponseValue(response?.status,
      ["completed", "incomplete", "failed", "cancelled", "queued", "in_progress"]),
    incompleteReason: response?.incomplete_details == null ? null
      : safeResponseValue(response.incomplete_details.reason, ["max_output_tokens", "content_filter"]),
    outputItemCount: output?.length ?? null,
    outputItemTypes: output?.slice(0, 20).map((item) => safeResponseValue(item?.type,
      ["reasoning", "message", "function_call", "web_search_call", "file_search_call"])) ?? null,
    outputTextCount: content.filter((item) => item?.type === "output_text"
      && typeof item.text === "string").length,
    outputTextLength: content.reduce((length, item) => length
      + (item?.type === "output_text" && typeof item.text === "string"
        ? item.text.length : 0), 0),
    requestMaxOutputTokens: tokenCount(requestMaxOutputTokens),
    responseMaxOutputTokens: tokenCount(response?.max_output_tokens),
    inputTokens: tokenCount(response?.usage?.input_tokens),
    outputTokens: tokenCount(response?.usage?.output_tokens),
    totalTokens: tokenCount(response?.usage?.total_tokens),
    cachedInputTokens: tokenCount(response?.usage?.input_tokens_details?.cached_tokens),
    reasoningOutputTokens: tokenCount(response?.usage?.output_tokens_details?.reasoning_tokens),
  };
};

const summarizeErrorChain = (error) => {
  const chain = [];
  const seen = new Set();
  let current = error;
  while (current instanceof Error && chain.length < 5 && !seen.has(current)) {
    seen.add(current);
    const message = SAFE_MESSAGES.has(current.message) ? current.message : "[redacted]";
    const stack = typeof current.stack === "string"
      ? current.stack.split("\n").slice(1).filter((line) => /^\s+at /.test(line)
        && (line.includes("file://") || line.includes("node:"))).slice(0, 8)
        .map((line) => line.trim().slice(0, 240))
      : [];
    chain.push({
      className: safeName(current.constructor?.name),
      name: safeName(current.name),
      message,
      messageLength: typeof current.message === "string" ? current.message.length : null,
      stack,
      networkCode: NETWORK_CODES.has(current.code) ? current.code : null,
      httpStatus: Number.isInteger(current.status) ? current.status : null,
      sdkRequestId: typeof current.requestID === "string"
        && /^[A-Za-z0-9_-]{1,80}$/.test(current.requestID) ? current.requestID : null,
    });
    current = current.cause;
  }
  return chain;
};

function createCodexClient({ apiKey, baseURL, model, logger }) {
  assertNonEmptyString(apiKey, "apiKey");
  assertNonEmptyString(baseURL, "baseURL");
  assertNonEmptyString(model, "model");

  if (!logger || ["error", "info"].some((method) => typeof logger[method] !== "function")) {
    throw new TypeError("logger must provide error and info methods");
  }

  const configuredModel = model.trim();

  const sdkClient = new OpenAI({
    apiKey: apiKey.trim(),
    baseURL: baseURL.trim(),
    maxRetries: 0,
    timeout: 90_000,
  });

  // Retries and provider recovery belong to llm-fallback.js.
  const createResponse = async ({ input, diagnostic, ...options } = {}) => {
    try {
      logger.info("AI provider API request started", {
        provider: "codex",
        model: configuredModel,
        operation: "responses.create",
      });
      diagnostic?.({ gate: "request", status: "STARTED", provider: "codex",
        model: configuredModel });

      const request = sdkClient.responses.create({
        ...options,
        model: configuredModel,
        input,
      });
      // withResponse resolves the same SDK promise and exposes its HTTP response.
      const { data: response, response: httpResponse } = diagnostic
        ? await request.withResponse()
        : { data: await request };
      diagnostic?.({ gate: "http_sdk", status: "PASS", code: "HTTP_RESPONSE",
        httpStatus: httpResponse.status, sdkRequestCount: 1 });
      diagnostic?.(summarizeResponse(response, options.max_output_tokens));

      logProviderUsage({
        logger,
        provider: "codex",
        model: configuredModel,
        usage: {
          inputTokens: response?.usage?.input_tokens,
          outputTokens: response?.usage?.output_tokens,
          totalTokens: response?.usage?.total_tokens,
          cachedTokens: response?.usage?.input_tokens_details?.cached_tokens,
        },
      });
      diagnostic?.({ gate: "usage", status: "PASS",
        inputTokens: response?.usage?.input_tokens ?? null,
        outputTokens: response?.usage?.output_tokens ?? null,
        totalTokens: response?.usage?.total_tokens ?? null });

      return response;
    } catch (error) {
      diagnostic?.({ gate: "http_sdk", status: "FAIL", code: "SDK_REQUEST_FAILED",
        httpStatus: Number.isInteger(error?.status) ? error.status : null,
        sdkRequestCount: 1 });
      diagnostic?.({ gate: "exception", status: "FAIL", chain: summarizeErrorChain(error) });
      logger.error("Codex createResponse failed", {
        provider: "codex",
        model: configuredModel,
        ...getProviderErrorMetadata(error),
      });

      throw error;
    }
  };

  return Object.freeze({ createResponse });
}

export { createCodexClient };
