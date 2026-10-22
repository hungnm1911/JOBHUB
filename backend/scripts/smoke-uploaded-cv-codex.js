import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const parseSmokeArgs = (args) => {
  let pdfPath;
  let live = false;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--pdf" && typeof args[index + 1] === "string" && !args[index + 1].startsWith("--")) {
      if (pdfPath !== undefined) throw new TypeError("CLI_USAGE");
      pdfPath = args[++index];
    } else if (args[index] === "--live" && !live) {
      live = true;
    } else {
      throw new TypeError("CLI_USAGE");
    }
  }

  if (!pdfPath?.trim()) throw new TypeError("CLI_USAGE");
  return { pdfPath, live };
};

const runBackendUploadedCvCodexSmoke = async ({ args, config, runSmoke, readPdf = readFile, emit = console.info }) => {
  const { pdfPath, live } = parseSmokeArgs(args);
  const codex = config.aiKit.llm.codex;
  const report = (record) => {
    const output = JSON.stringify(record);
    emit(codex.apiKey ? output.replaceAll(codex.apiKey, "[REDACTED]") : output);
  };

  let pdfBuffer;
  try {
    // The npm command starts in backend/, while --pdf is relative to ai-kit/.
    pdfBuffer = await readPdf(resolve(process.cwd(), "../ai-kit", pdfPath));
  } catch {
    const result = { phase: "preflight", status: "FAILED", reason: "PDF_READ_ERROR" };
    report(result);
    return result;
  }

  return runSmoke({ pdfBuffer, codex, live, report });
};

const main = async () => {
  try {
    const [{ default: config }, { runUploadedCvCodexSmoke }] = await Promise.all([
      import("../src/config/index.js"),
      import("@jobhub/ai-kit/tooling/smoke-uploaded-cv-codex"),
    ]);
    const result = await runBackendUploadedCvCodexSmoke({
      args: process.argv.slice(2), config, runSmoke: runUploadedCvCodexSmoke,
    });
    if (result.status !== "READY") process.exitCode = 1;
  } catch {
    console.error('{"phase":"preflight","status":"FAILED","reason":"CONFIGURATION_OR_CLI_ERROR"}');
    process.exitCode = 1;
  }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

export { parseSmokeArgs, runBackendUploadedCvCodexSmoke };
