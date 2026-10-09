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

const formatPretty = ({ timestamp, level, message, requestId, meta, useColors }) => {
  const label = colorize(
    level.toUpperCase().padEnd(5),
    LEVEL_ANSI_COLOR[level],
    useColors,
  );
  const scope = requestId ? ` [${requestId}]` : "";
  const details = Object.keys(meta).length > 0
    ? `\n${inspect(meta, { colors: useColors, depth: 6, breakLength: 100 })}`
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
  const timestamp = new Date().toISOString();

  if (config.logging.format === "json") {
    const serializedMeta = Object.fromEntries(
      Object.entries(meta).map(([key, value]) => [key, serializeError(value)]),
    );

    stream.write(`${toJsonLine({
      timestamp,
      level,
      message,
      requestId,
      ...serializedMeta,
    })}\n`);

    return;
  }

  stream.write(`${formatPretty({
    timestamp,
    level,
    message,
    requestId,
    meta,
    useColors: Boolean(stream.isTTY),
  })}\n`);
};

const logger = Object.freeze({
  error: (message, meta) => write("error", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  info: (message, meta) => write("info", message, meta),
  debug: (message, meta) => write("debug", message, meta),
});

export default logger;
