import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { extractPdfText } from "../src/document/pdf-text-extractor.js";

const fixturePath = fileURLToPath(
  new URL("./fixtures/pdf-text-extraction.pdf", import.meta.url),
);

describe("PDF text extractor", () => {
  it("extracts plain text from a local text-native PDF", async () => {
    const text = await extractPdfText(fixturePath);

    expect(text).toContain("JOBHUB PDF EXTRACTION OK");
  }, 30_000);
});
