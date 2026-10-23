import { fileURLToPath } from "node:url";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const standardFontDataUrl = fileURLToPath(new URL(
  "../../standard_fonts/",
  import.meta.resolve("pdfjs-dist/legacy/build/pdf.mjs"),
));

const PDF_TEXT_EXTRACTION_ERROR_CODE = Object.freeze({
  INVALID_PDF_INPUT: "INVALID_PDF_INPUT",
  PDF_UNREADABLE: "PDF_UNREADABLE",
  PDF_TEXT_NOT_EXTRACTABLE: "PDF_TEXT_NOT_EXTRACTABLE",
});

class PdfTextExtractionError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "PdfTextExtractionError";
    this.code = code;
  }
}

const extractTextLayer = async (source) => {
  const loadingTask = getDocument({
    ...source,
    isEvalSupported: false,
    standardFontDataUrl,
  });

  try {
    const document = await loadingTask.promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);

      try {
        const { items } = await page.getTextContent();
        pages.push(items
          .filter((item) => typeof item.str === "string")
          .map((item) => `${item.str}${item.hasEOL ? "\n" : " "}`)
          .join("")
          .trim());
      } finally {
        page.cleanup();
      }
    }

    return pages.join("\n\n").trim();
  } finally {
    await loadingTask.destroy();
  }
};

const extractPdfText = async (pdfPath) => {
  if (typeof pdfPath !== "string" || pdfPath.trim().length === 0) {
    throw new TypeError("pdfPath must be a non-empty string");
  }

  return extractTextLayer({ url: pdfPath.trim() });
};

const extractPdfTextFromBuffer = async (pdfBuffer) => {
  if (!(pdfBuffer instanceof Uint8Array) || pdfBuffer.byteLength === 0) {
    throw new PdfTextExtractionError(
      PDF_TEXT_EXTRACTION_ERROR_CODE.INVALID_PDF_INPUT,
      "pdfBuffer must be a non-empty Buffer or Uint8Array",
    );
  }

  let text;

  try {
    // PDF.js may transfer (detach) the data it receives; the copy keeps the caller's bytes intact.
    text = await extractTextLayer({ data: new Uint8Array(pdfBuffer) });
  } catch (cause) {
    throw new PdfTextExtractionError(
      PDF_TEXT_EXTRACTION_ERROR_CODE.PDF_UNREADABLE,
      "PDF content could not be read",
      { cause },
    );
  }

  if (text.length === 0) {
    throw new PdfTextExtractionError(
      PDF_TEXT_EXTRACTION_ERROR_CODE.PDF_TEXT_NOT_EXTRACTABLE,
      "PDF has no extractable text layer",
    );
  }

  return text;
};

export {
  extractPdfText,
  extractPdfTextFromBuffer,
  PDF_TEXT_EXTRACTION_ERROR_CODE,
  PdfTextExtractionError,
};
