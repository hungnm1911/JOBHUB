import { pathToFileURL } from "node:url";

let configuredApiKey;
let providerErrorLogged = false;

const redactApiKey = (value) => {
  const text = String(value);

  if (!configuredApiKey) {
    return text;
  }

  return text.replaceAll(configuredApiKey, "[REDACTED]");
};

const formatError = (error) => {
  if (!(error instanceof Error)) {
    return redactApiKey(error);
  }

  const details = [error.name, redactApiKey(error.message)];
  const status = error.status ?? error.statusCode;

  if (status !== undefined) {
    details.push(`status=${redactApiKey(status)}`);
  }

  if (error.code !== undefined) {
    details.push(`code=${redactApiKey(error.code)}`);
  }

  let cause = error.cause;

  for (let i = 0; cause && i < 3; i++) {
    details.push(
      `cause=${redactApiKey(cause.message ?? String(cause))}`,
    );

    if (cause.code) {
      details.push(`causeCode=${cause.code}`);
    }

    if (Array.isArray(cause.errors)) {
      details.push(
        `nestedCodes=${cause.errors.map(e => e.code).join(",")}`,
      );
    }

    cause = cause.cause;
  }

  return details.join(" | ");
};

const smokeLogger = Object.freeze({
  error: (message, { error, ...metadata } = {}) => {
    providerErrorLogged = true;
    const details = error === undefined ? "" : `: ${formatError(error)}`;

    console.error(
      redactApiKey(`${message}${details} | ${JSON.stringify(metadata)}`),
    );
  },
  info: (message, metadata = {}) => {
    console.info(redactApiKey(`${message}: ${JSON.stringify(metadata)}`));
  },
});

const requireSmokeConfiguration = (codex) => {
  if (!codex.apiKey) {
    throw new Error("Missing CCPRO_API_KEY in backend/.env");
  }

  if (!codex.baseURL) {
    throw new Error("Missing CCPRO_BASE_URL in backend/.env");
  }

  if (!codex.model) {
    throw new Error("Missing CCPRO_MODEL in backend/.env");
  }
};

const runBackendCodexSmoke = async ({ config, runCodexSmoke }) => {
  const { codex } = config.aiKit.llm;

  providerErrorLogged = false;
  configuredApiKey = codex.apiKey;
  requireSmokeConfiguration(codex);

  return runCodexSmoke({ ...codex, logger: smokeLogger });
};

const main = async () => {
  const [{ default: config }, { runCodexSmoke }] = await Promise.all([
    import("../src/config/index.js"),
    import("@jobhub/ai-kit/tooling/smoke-codex"),
  ]);
  await runBackendCodexSmoke({ config, runCodexSmoke });
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    if (!providerErrorLogged) {
      console.error(`Codex smoke test failed: ${formatError(error)}`);
    }

    process.exitCode = 1;
  });
}

export { runBackendCodexSmoke };
