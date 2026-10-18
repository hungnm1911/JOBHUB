import { beforeEach, describe, expect, it, vi } from "vitest";

const scribe = vi.hoisted(() => ({
  openDocument: vi.fn(),
  terminate: vi.fn(),
}));

vi.mock("scribe.js-ocr", () => ({ default: scribe }));

import {
  disposePdfTextExtractor,
  extractPdfText,
} from "../src/document/pdf-text-extractor.js";

const createDeferred = () => {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

const createDocument = ({ exportData = vi.fn().mockResolvedValue("text") } = {}) => ({
  close: vi.fn().mockResolvedValue(undefined),
  exportData,
  inputData: { requiresOCR: false },
  recognize: vi.fn(),
});

describe("PDF text extractor lifecycle", () => {
  beforeEach(() => {
    scribe.openDocument.mockReset();
    scribe.terminate.mockReset().mockResolvedValue(undefined);
  });

  it("closes the document after successful extraction", async () => {
    const document = createDocument();
    scribe.openDocument.mockResolvedValue(document);

    await expect(extractPdfText("success.pdf")).resolves.toBe("text");

    expect(document.close).toHaveBeenCalledOnce();
    expect(scribe.terminate).not.toHaveBeenCalled();
  });

  it("closes the document when extraction throws", async () => {
    const extractionError = new Error("extraction failed");
    const document = createDocument({
      exportData: vi.fn().mockRejectedValue(extractionError),
    });
    scribe.openDocument.mockResolvedValue(document);

    await expect(extractPdfText("failure.pdf")).rejects.toBe(extractionError);

    expect(document.close).toHaveBeenCalledOnce();
    expect(scribe.terminate).not.toHaveBeenCalled();
  });

  it("does not terminate shared Scribe resources while extractions overlap", async () => {
    const firstExport = createDeferred();
    const secondExport = createDeferred();
    const firstDocument = createDocument({
      exportData: vi.fn().mockReturnValue(firstExport.promise),
    });
    const secondDocument = createDocument({
      exportData: vi.fn().mockReturnValue(secondExport.promise),
    });
    scribe.openDocument
      .mockResolvedValueOnce(firstDocument)
      .mockResolvedValueOnce(secondDocument);

    const firstExtraction = extractPdfText("first.pdf");
    const secondExtraction = extractPdfText("second.pdf");

    await vi.waitFor(() => {
      expect(firstDocument.exportData).toHaveBeenCalledOnce();
      expect(secondDocument.exportData).toHaveBeenCalledOnce();
    });

    firstExport.resolve("first text");
    await expect(firstExtraction).resolves.toBe("first text");

    expect(firstDocument.close).toHaveBeenCalledOnce();
    expect(secondDocument.close).not.toHaveBeenCalled();
    expect(scribe.terminate).not.toHaveBeenCalled();

    secondExport.resolve("second text");
    await expect(secondExtraction).resolves.toBe("second text");

    expect(secondDocument.close).toHaveBeenCalledOnce();
    expect(scribe.terminate).not.toHaveBeenCalled();
  });

  it("terminates shared Scribe resources only on explicit dispose", async () => {
    await disposePdfTextExtractor();

    expect(scribe.terminate).toHaveBeenCalledOnce();
  });
});
