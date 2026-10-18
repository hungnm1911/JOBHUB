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

  return details.join(" | ");
};

const smokeLogger = Object.freeze({
  error: (message, { error, model } = {}) => {
    providerErrorLogged = true;
    console.error(
      `${message}: ${formatError(error)} | model=${redactApiKey(model)}`,
    );
  },
});

const requireSmokeConfiguration = (gemini) => {
  if (!gemini.apiKey) {
    throw new Error("Missing GEMINI_API_KEY in backend/.env");
  }

  if (!gemini.model) {
    throw new Error("Missing GEMINI_MODEL in backend/.env");
  }
};

const runBackendGeminiSmoke = async ({ config, runGeminiSmoke }) => {
  const { gemini } = config.aiKit.llm;

  configuredApiKey = gemini.apiKey;
  requireSmokeConfiguration(gemini);

  return runGeminiSmoke({
    apiKey: gemini.apiKey,
    model: gemini.model,
    logger: smokeLogger,
  });
};

const main = async () => {
  const [{ default: config }, { runGeminiSmoke }] = await Promise.all([
    import("../src/config/index.js"),
    import("@jobhub/ai-kit/tooling/smoke-gemini"),
  ]);
  const result = await runBackendGeminiSmoke({ config, runGeminiSmoke });

  console.log(
    `Gemini smoke test passed | model=${result.model}`
      + ` | response=${JSON.stringify(result.responseText)}`,
  );
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    if (!providerErrorLogged) {
      console.error(`Gemini smoke test failed: ${formatError(error)}`);
    }

    process.exitCode = 1;
  });
}

export { runBackendGeminiSmoke };
