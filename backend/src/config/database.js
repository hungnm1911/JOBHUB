const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 10_000;

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error(
    "Missing required environment variable: MONGODB_URI",
  );
}

const serverSelectionTimeoutMS = Number(
  process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS
    || DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
);

if (
  !Number.isInteger(serverSelectionTimeoutMS)
  || serverSelectionTimeoutMS <= 0
) {
  throw new Error(
    "MONGODB_SERVER_SELECTION_TIMEOUT_MS must be a positive integer",
  );
}

export default Object.freeze({
  uri,
  serverSelectionTimeoutMS,
});