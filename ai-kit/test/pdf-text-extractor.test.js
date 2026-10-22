import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  extractPdfText,
  extractPdfTextFromBuffer,
  PDF_TEXT_EXTRACTION_ERROR_CODE,
} from "../src/document/pdf-text-extractor.js";

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

describe("PDF text extractor from an uploaded PDF Buffer", () => {
  const readFixture = (name) => readFile(fixturePath(name));

  it("extracts free text from a text-native PDF Buffer and leaves the Buffer intact", async () => {
    const pdfBuffer = await readFixture("pdf-text-extraction.pdf");
    const original = Buffer.from(pdfBuffer);

    await expect(extractPdfTextFromBuffer(pdfBuffer))
      .resolves.toContain("JOBHUB PDF EXTRACTION OK");
    expect(pdfBuffer.equals(original)).toBe(true);
  });

  it("retains line breaks and page order for a multi-page Uint8Array", async () => {
    const pdfBytes = new Uint8Array(await readFixture("pdf-text-multipage.pdf"));

    await expect(extractPdfTextFromBuffer(pdfBytes))
      .resolves.toBe("FIRST PAGE\nSECOND LINE\n\nSECOND PAGE");
  });

  it("fails an image-only PDF as not extractable instead of returning empty text", async () => {
    await expect(extractPdfTextFromBuffer(await readFixture("pdf-image-only.pdf")))
      .rejects.toMatchObject({
        name: "PdfTextExtractionError",
        code: PDF_TEXT_EXTRACTION_ERROR_CODE.PDF_TEXT_NOT_EXTRACTABLE,
      });
  });

  it("fails unreadable bytes as an extraction failure and can extract afterwards", async () => {
    await expect(extractPdfTextFromBuffer(Buffer.from("not a pdf document")))
      .rejects.toMatchObject({ code: PDF_TEXT_EXTRACTION_ERROR_CODE.PDF_UNREADABLE });
    await expect(extractPdfTextFromBuffer(await readFixture("pdf-text-extraction.pdf")))
      .resolves.toContain("JOBHUB PDF EXTRACTION OK");
  });

  it("supports concurrent Buffer and path extractions", async () => {
    const results = await Promise.all([
      extractPdfTextFromBuffer(await readFixture("pdf-text-multipage.pdf")),
      extractPdfText(fixturePath()),
    ]);

    expect(results[0]).toContain("SECOND PAGE");
    expect(results[1]).toContain("JOBHUB PDF EXTRACTION OK");
  });
});
