import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { extractPdfText } from "../src/document/pdf-text-extractor.js";

const fixturePath = (name = "pdf-text-extraction.pdf") => fileURLToPath(
  new URL(`./fixtures/${name}`, import.meta.url),
);

describe("PDF text extractor", () => {
  it("extracts plain text from a local text-native PDF", async () => {
    const text = await extractPdfText(fixturePath());

    expect(text).toContain("JOBHUB PDF EXTRACTION OK");
  }, 30_000);

  it("retains line breaks and page order in a real multi-page PDF", async () => {
    await expect(extractPdfText(fixturePath("pdf-text-multipage.pdf")))
      .resolves.toBe("FIRST PAGE\nSECOND LINE\n\nSECOND PAGE");
  });

  it("returns empty text for a real image-only PDF", async () => {
    await expect(extractPdfText(fixturePath("pdf-image-only.pdf")))
      .resolves.toBe("");
  });

  it("supports concurrent real extractions and a later extraction", async () => {
    const results = await Promise.all([
      extractPdfText(fixturePath()),
      extractPdfText(fixturePath("pdf-text-multipage.pdf")),
    ]);

    expect(results[0]).toContain("JOBHUB PDF EXTRACTION OK");
    expect(results[1]).toContain("SECOND PAGE");
    await expect(extractPdfText(fixturePath()))
      .resolves.toContain("JOBHUB PDF EXTRACTION OK");
  });

  it("propagates a missing-file failure and can extract afterwards", async () => {
    await expect(extractPdfText(fixturePath("missing.pdf"))).rejects.toThrow();
    await expect(extractPdfText(fixturePath()))
      .resolves.toContain("JOBHUB PDF EXTRACTION OK");
  });
});
