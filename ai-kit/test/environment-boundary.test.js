import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const scriptsRoot = fileURLToPath(new URL("../scripts/", import.meta.url));

const listJavaScriptFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listJavaScriptFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
  }));

  return nestedFiles.flat();
};

const readJavaScriptSources = async (roots) => {
  const sourceFiles = (
    await Promise.all(roots.map(listJavaScriptFiles))
  ).flat();

  return Promise.all(
    sourceFiles.map(async (filePath) => ({
      filePath,
      source: await readFile(filePath, "utf8"),
    })),
  );
};

const joinPackageSources = (sources) => {
  return sources.map(({ source }) => source).join("\n");
};

describe("AI Kit environment boundary", () => {
  it("does not read process.env from package source or tooling", async () => {
    const sources = await readJavaScriptSources([sourceRoot, scriptsRoot]);

    expect(joinPackageSources(sources)).not.toContain("process.env");
  });

  it("does not import Backend modules from package source or tooling", async () => {
    const sources = await readJavaScriptSources([sourceRoot, scriptsRoot]);

    expect(joinPackageSources(sources)).not.toMatch(
      /(?:from\s+|import\s*\()\s*["'][^"']*backend/i,
    );
  });

  it("keeps the direct Gemini SDK import inside the Gemini adapter", async () => {
    const sources = await readJavaScriptSources([sourceRoot]);
    const sdkConsumers = sources
      .filter(({ source }) => source.includes("@google/genai"))
      .map(({ filePath }) => path.relative(sourceRoot, filePath));

    expect(sdkConsumers).toEqual([path.join("llm", "gemini-client.js")]);
  });

  it("keeps the direct Groq SDK import inside the Groq adapter", async () => {
    const sources = await readJavaScriptSources([sourceRoot]);
    const sdkConsumers = sources
      .filter(({ source }) => source.includes("groq-sdk"))
      .map(({ filePath }) => path.relative(sourceRoot, filePath));

    expect(sdkConsumers).toEqual([path.join("llm", "groq-client.js")]);
  });

  it("keeps the direct OpenAI SDK import inside the Codex adapter", async () => {
    const sources = await readJavaScriptSources([sourceRoot]);
    const sdkConsumers = sources
      .filter(({ source }) => source.includes('from "openai"'))
      .map(({ filePath }) => path.relative(sourceRoot, filePath));

    expect(sdkConsumers).toEqual([path.join("llm", "codex-client.js")]);
  });

  it("keeps the direct PDF.js import inside the PDF text extractor", async () => {
    const sources = await readJavaScriptSources([sourceRoot, scriptsRoot]);
    const pdfConsumers = sources
      .filter(({ source }) => source.includes("pdfjs-dist"))
      .map(({ filePath }) => path.relative(sourceRoot, filePath));

    expect(pdfConsumers).toEqual([
      path.join("document", "pdf-text-extractor.js"),
    ]);
    expect(joinPackageSources(sources)).not.toContain("scribe.js-ocr");
  });
});
