import scribe from "scribe.js-ocr";

const extractPdfText = async (pdfPath) => {
  if (typeof pdfPath !== "string" || pdfPath.trim().length === 0) {
    throw new TypeError("pdfPath must be a non-empty string");
  }

  let document;

  try {
    document = await scribe.openDocument([pdfPath.trim()]);

    if (document.inputData.requiresOCR) {
      await document.recognize({
        langs: ["eng"],
        ocrPages: "autoShallow",
      });
    }

    const text = await document.exportData("text");

    if (typeof text !== "string") {
      throw new TypeError("Scribe must return extracted text as a string");
    }

    return text;
  } finally {
    await document?.close();
  }
};

const disposePdfTextExtractor = async () => {
  await scribe.terminate();
};

export { disposePdfTextExtractor, extractPdfText };
