import { AsyncLocalStorage } from "node:async_hooks";
import { inspect } from "node:util";

import config from "../config/index.js";

const LEVEL_PRIORITY = Object.freeze({
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
});

const LEVEL_ANSI_COLOR = Object.freeze({
  error: 31,
  warn: 33,
  info: 36,
  debug: 90,
});

const MAX_CAUSE_DEPTH = 5;
const requestIds = new AsyncLocalStorage();
const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: config.logging.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const formatTimestamp = (date) => {
  const parts = Object.fromEntries(
    timestampFormatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`
    + ` ${parts.hour}:${parts.minute}:${parts.second}`;
};

const runWithRequestId = (requestId, callback) => requestIds.run(requestId, callback);

const serializeError = (error, depth = 0) => {
  if (!(error instanceof Error)) {
    return error;
  }

  const serialized = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  for (const key of ["code", "statusCode", "status", "details"]) {
    if (error[key] !== undefined && error[key] !== null) {
      serialized[key] = error[key];
    }
  }

  if (error.cause !== undefined && depth < MAX_CAUSE_DEPTH) {
    serialized.cause = serializeError(error.cause, depth + 1);
  }

  return serialized;
};

const toJsonLine = (entry) => {
  try {
    return JSON.stringify(entry);
  } catch {
    return JSON.stringify({
      ...entry,
      meta: inspect(entry, { depth: 4, breakLength: Infinity }),
    });
  }
};

const colorize = (text, ansiColor, useColors) => {
  return useColors ? `\u001b[${ansiColor}m${text}\u001b[0m` : text;
};

const formatPretty = ({ timestamp, level, message, requestId, meta, useColors,
  fullDetails }) => {
  const label = colorize(
    level.toUpperCase().padEnd(5),
    LEVEL_ANSI_COLOR[level],
    useColors,
  );
  const scope = requestId ? ` [${requestId}]` : "";
  const details = Object.keys(meta).length > 0
    ? `\n${inspect(meta, { colors: useColors, depth: fullDetails ? null : 6,
      maxArrayLength: fullDetails ? null : 100,
      maxStringLength: fullDetails ? null : 10_000, breakLength: 100 })}`
    : "";

  return `${timestamp} ${label}${scope} ${message}${details}`;
};

const write = (level, message, { requestId, ...meta } = {}) => {
  if (LEVEL_PRIORITY[level] > LEVEL_PRIORITY[config.logging.level]) {
    return;
  }

  const stream = LEVEL_PRIORITY[level] <= LEVEL_PRIORITY.warn
    ? process.stderr
    : process.stdout;
  const timestamp = formatTimestamp(new Date());
  const activeRequestId = requestId ?? requestIds.getStore();
  const logSite = config.env === "development"
    ? new Error().stack?.split("\n")[3]?.trim() : undefined;
  const outputMeta = logSite ? { ...meta, logSite } : meta;

  if (config.logging.format === "json") {
    const serializedMeta = Object.fromEntries(
      Object.entries(outputMeta).map(([key, value]) => [key, serializeError(value)]),
    );

    stream.write(`${toJsonLine({
      timestamp,
      level,
      message,
      requestId: activeRequestId,
      ...serializedMeta,
    })}\n`);

    return;
  }

  stream.write(`${formatPretty({
    timestamp,
    level,
    message,
    requestId: activeRequestId,
    meta: outputMeta,
    useColors: Boolean(stream.isTTY),
    fullDetails: config.env === "development",
  })}\n`);
};

const logger = Object.freeze({
  error: (message, meta) => write("error", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  info: (message, meta) => write("info", message, meta),
  debug: (message, meta) => write("debug", message, meta),
  development: (message, meta) => {
    if (config.env === "development") write("debug", message, meta);
  },
});

export default logger;
export { runWithRequestId };
