import { fileURLToPath } from "node:url";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const standardFontDataUrl = fileURLToPath(new URL(
  "../../standard_fonts/",
  import.meta.resolve("pdfjs-dist/legacy/build/pdf.mjs"),
));

const extractPdfText = async (pdfPath) => {
  if (typeof pdfPath !== "string" || pdfPath.trim().length === 0) {
    throw new TypeError("pdfPath must be a non-empty string");
  }

  const loadingTask = getDocument({
    url: pdfPath.trim(),
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

export { extractPdfText };
