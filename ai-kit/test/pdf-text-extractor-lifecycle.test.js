import { beforeEach, describe, expect, it, vi } from "vitest";

const pdfjs = vi.hoisted(() => ({ getDocument: vi.fn() }));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => pdfjs);

import {
  extractPdfText,
  extractPdfTextFromBuffer,
  PDF_TEXT_EXTRACTION_ERROR_CODE,
} from "../src/document/pdf-text-extractor.js";

const createDeferred = () => {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

const createPage = (items = [{ str: "text", hasEOL: false }]) => ({
  cleanup: vi.fn(),
  getTextContent: vi.fn().mockResolvedValue({ items }),
});

const loadPages = (pages) => {
  const document = {
    numPages: pages.length,
    getPage: vi.fn().mockImplementation(async (number) => pages[number - 1]),
  };
  const task = {
    promise: Promise.resolve(document),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
  pdfjs.getDocument.mockReturnValueOnce(task);

  return { document, task };
};

describe("PDF text extractor lifecycle", () => {
  beforeEach(() => {
    pdfjs.getDocument.mockReset();
  });

  it.each([undefined, null, 123, {}, "", " \n "])(
    "refuses invalid paths before creating resources: %j",
    async (input) => {
      await expect(extractPdfText(input)).rejects.toThrow(
        "pdfPath must be a non-empty string",
      );
      expect(pdfjs.getDocument).not.toHaveBeenCalled();
    },
  );

  it("extracts pages in order, keeps line/page boundaries and skips marked-content items", async () => {
    const first = createPage([
      { type: "beginMarkedContent", id: "section" },
      { str: "First", hasEOL: false },
      { str: "line", hasEOL: true },
      { str: "Next line", hasEOL: true },
      { type: "endMarkedContent" },
    ]);
    const second = createPage([{ str: "Second page", hasEOL: false }]);
    const { document, task } = loadPages([first, second]);

    await expect(extractPdfText("  success.pdf  ")).resolves.toBe(
      "First line\nNext line\n\nSecond page",
    );

    expect(pdfjs.getDocument).toHaveBeenCalledWith({
      url: "success.pdf",
      isEvalSupported: false,
      standardFontDataUrl: expect.stringMatching(/[/\\]pdfjs-dist[/\\]standard_fonts[/\\]$/),
    });
    expect(document.getPage.mock.calls).toEqual([[1], [2]]);
    expect(first.cleanup).toHaveBeenCalledOnce();
    expect(second.cleanup).toHaveBeenCalledOnce();
    expect(task.destroy).toHaveBeenCalledOnce();
  });

  it("returns empty text for pages without a text layer, without OCR", async () => {
    const { task } = loadPages([createPage([]), createPage([])]);

    await expect(extractPdfText("scan.pdf")).resolves.toBe("");
    expect(task.destroy).toHaveBeenCalledOnce();
  });

  it("destroys the loading task when loading fails", async () => {
    const error = new Error("invalid PDF");
    const task = {
      promise: Promise.reject(error),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    pdfjs.getDocument.mockReturnValue(task);

    await expect(extractPdfText("invalid.pdf")).rejects.toBe(error);
    expect(task.destroy).toHaveBeenCalledOnce();
  });

  it("destroys the task when a page cannot be loaded", async () => {
    const error = new Error("page unavailable");
    const { document, task } = loadPages([createPage()]);
    document.getPage.mockRejectedValue(error);

    await expect(extractPdfText("broken.pdf")).rejects.toBe(error);
    expect(task.destroy).toHaveBeenCalledOnce();
  });

  it("cleans up the page and task when text extraction fails", async () => {
    const error = new Error("extraction failed");
    const page = createPage();
    page.getTextContent.mockRejectedValue(error);
    const { task } = loadPages([page]);

    await expect(extractPdfText("failure.pdf")).rejects.toBe(error);
    expect(page.cleanup).toHaveBeenCalledOnce();
    expect(task.destroy).toHaveBeenCalledOnce();
  });

  it("destroys the task even when page cleanup throws", async () => {
    const error = new Error("cleanup failed");
    const page = createPage();
    page.cleanup.mockImplementation(() => { throw error; });
    const { task } = loadPages([page]);

    await expect(extractPdfText("failure.pdf")).rejects.toBe(error);
    expect(task.destroy).toHaveBeenCalledOnce();
  });

  it("keeps overlapping extractions independent and allows reuse after cleanup", async () => {
    const firstText = createDeferred();
    const secondText = createDeferred();
    const firstPage = createPage();
    const secondPage = createPage();
    firstPage.getTextContent.mockReturnValue(firstText.promise);
    secondPage.getTextContent.mockReturnValue(secondText.promise);
    const first = loadPages([firstPage]);
    const second = loadPages([secondPage]);

    const firstExtraction = extractPdfText("first.pdf");
    const secondExtraction = extractPdfText("second.pdf");
    await vi.waitFor(() => {
      expect(firstPage.getTextContent).toHaveBeenCalledOnce();
      expect(secondPage.getTextContent).toHaveBeenCalledOnce();
    });

    firstText.resolve({ items: [{ str: "first text" }] });
    await expect(firstExtraction).resolves.toBe("first text");
    expect(first.task.destroy).toHaveBeenCalledOnce();
    expect(secondPage.cleanup).not.toHaveBeenCalled();
    expect(second.task.destroy).not.toHaveBeenCalled();

    secondText.resolve({ items: [{ str: "second text" }] });
    await expect(secondExtraction).resolves.toBe("second text");
    expect(second.task.destroy).toHaveBeenCalledOnce();

    const third = loadPages([createPage()]);
    await expect(extractPdfText("third.pdf")).resolves.toBe("text");
    expect(third.task.destroy).toHaveBeenCalledOnce();
  });
});

describe("PDF Buffer text extractor lifecycle", () => {
  beforeEach(() => {
    pdfjs.getDocument.mockReset();
  });

  it.each([undefined, null, "file.pdf", [1, 2], new ArrayBuffer(4), Buffer.alloc(0)])(
    "refuses invalid input before creating resources: %j",
    async (input) => {
      await expect(extractPdfTextFromBuffer(input)).rejects.toMatchObject({
        name: "PdfTextExtractionError",
        code: PDF_TEXT_EXTRACTION_ERROR_CODE.INVALID_PDF_INPUT,
      });
      expect(pdfjs.getDocument).not.toHaveBeenCalled();
    },
  );

  it("passes a copy of the bytes to PDF.js and cleans up after success", async () => {
    const page = createPage([{ str: "Uploaded CV text", hasEOL: false }]);
    const { task } = loadPages([page]);
    const pdfBuffer = Buffer.from("%PDF-bytes");

    await expect(extractPdfTextFromBuffer(pdfBuffer)).resolves.toBe("Uploaded CV text");

    const [{ data, url }] = pdfjs.getDocument.mock.calls[0];
    expect(url).toBeUndefined();
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data).not.toBe(pdfBuffer);
    expect(data.buffer).not.toBe(pdfBuffer.buffer);
    expect(Buffer.from(data).equals(pdfBuffer)).toBe(true);
    expect(page.cleanup).toHaveBeenCalledOnce();
    expect(task.destroy).toHaveBeenCalledOnce();
  });

  it("fails pages without a text layer as not extractable, without OCR", async () => {
    const { task } = loadPages([createPage([]), createPage([{ str: " " }])]);

    await expect(extractPdfTextFromBuffer(Buffer.from("scan"))).rejects.toMatchObject({
      code: PDF_TEXT_EXTRACTION_ERROR_CODE.PDF_TEXT_NOT_EXTRACTABLE,
    });
    expect(task.destroy).toHaveBeenCalledOnce();
  });

  it("wraps loading failures as unreadable with the cause and destroys the task", async () => {
    const cause = new Error("invalid PDF structure");
    const task = {
      promise: Promise.reject(cause),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    pdfjs.getDocument.mockReturnValue(task);

    const error = await extractPdfTextFromBuffer(Buffer.from("broken")).catch((e) => e);

    expect(error).toMatchObject({
      name: "PdfTextExtractionError",
      code: PDF_TEXT_EXTRACTION_ERROR_CODE.PDF_UNREADABLE,
      cause,
    });
    expect(error.message).not.toContain("invalid PDF structure");
    expect(task.destroy).toHaveBeenCalledOnce();
  });

  it("wraps text-content failures as unreadable and cleans up the page and task", async () => {
    const page = createPage();
    page.getTextContent.mockRejectedValue(new Error("extraction failed"));
    const { task } = loadPages([page]);

    await expect(extractPdfTextFromBuffer(Buffer.from("pdf"))).rejects.toMatchObject({
      code: PDF_TEXT_EXTRACTION_ERROR_CODE.PDF_UNREADABLE,
    });
    expect(page.cleanup).toHaveBeenCalledOnce();
    expect(task.destroy).toHaveBeenCalledOnce();
  });
});
