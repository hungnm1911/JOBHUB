let configuredApiKey;
let providerErrorLogged = false;
const REQUIRED_GROQ_MODEL = "openai/gpt-oss-120b";

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
  const code = error.code ?? error.error?.code;

  if (status !== undefined) {
    details.push(`status=${redactApiKey(status)}`);
  }

  if (code !== undefined) {
    details.push(`code=${redactApiKey(code)}`);
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

const requireSmokeConfiguration = (llm) => {
  if (!llm.apiKey) {
    throw new Error("Missing GROQ_API_KEY in backend/.env");
  }

  if (!llm.model) {
    throw new Error("Missing GROQ_MODEL in backend/.env");
  }

  if (llm.model !== REQUIRED_GROQ_MODEL) {
    throw new Error(
      `GROQ_MODEL must be ${REQUIRED_GROQ_MODEL} for this smoke test`,
    );
  }
};

const main = async () => {
  const [{ default: config }, { runGroqSmoke }] = await Promise.all([
    import("../src/config/index.js"),
    import("@jobhub/ai-kit/tooling/smoke-groq"),
  ]);
  const { groq } = config.aiKit.llm;

  configuredApiKey = groq.apiKey;
  requireSmokeConfiguration(groq);

  const result = await runGroqSmoke({
    apiKey: groq.apiKey,
    model: groq.model,
    logger: smokeLogger,
  });

  console.log(
    `Groq smoke test passed | model=${result.model}`
      + ` | response=${JSON.stringify(result.responseText)}`,
  );
};

main().catch((error) => {
  if (!providerErrorLogged) {
    console.error(`Groq smoke test failed: ${formatError(error)}`);
  }

  process.exitCode = 1;
});
