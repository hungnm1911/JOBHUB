import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

import { renderHarvardCandidateCvPdf } from "../../src/services/candidate-cv-harvard-pdf.service.js";
import { APPLICATION_CV_SNAPSHOT_STORAGE, captureCvSnapshot } from "../../src/services/cv-snapshot.service.js";

const snapshotUpload = vi.hoisted(() => ({ buffer: null }));
vi.mock("../../src/services/file.service.js", () => ({
  uploadFileBuffer: vi.fn(async ({ buffer }) => {
    snapshotUpload.buffer = Buffer.from(buffer);
    return { publicId: "v17-unicode-snapshot-test" };
  }),
  downloadFileBuffer: vi.fn(),
  deleteFile: vi.fn(),
}));

const fontPaths = {
  Regular: new URL("../../assets/fonts/noto-serif/NotoSerif-Regular.ttf", import.meta.url),
  Bold: new URL("../../assets/fonts/noto-serif/NotoSerif-Bold.ttf", import.meta.url),
  Italic: new URL("../../assets/fonts/noto-serif/NotoSerif-Italic.ttf", import.meta.url),
  CjkRegular: new URL("../../assets/fonts/noto-serif-cjk-jp/NotoSerifJP-Regular.ttf", import.meta.url),
  CjkBold: new URL("../../assets/fonts/noto-serif-cjk-jp/NotoSerifJP-Bold.ttf", import.meta.url),
};

const inspectPdf = async (bytes) => {
  const document = await PDFDocument.load(bytes);
  const measureDocument = await PDFDocument.create();
  measureDocument.registerFontkit(fontkit);
  const fonts = Object.fromEntries(await Promise.all(
    Object.entries(fontPaths).map(async ([style, path]) => [
      style, await measureDocument.embedFont(readFileSync(path)),
    ]),
  ));
  const pages = document.getPages().map((page, pageIndex) => {
    const resources = document.context.lookup(page.node.get(PDFName.of("Resources")));
    const fontRefs = document.context.lookup(resources.get(PDFName.of("Font")));
    const maps = new Map();
    for (const [name, ref] of fontRefs.entries()) {
      const font = document.context.lookup(ref);
      const cmap = inflateSync(document.context.lookup(font.get(PDFName.of("ToUnicode"))).getContents()).toString();
      maps.set(name.toString(), new Map([...cmap.matchAll(/<([0-9A-F]{4})> <([0-9A-F]+)>/gu)]
        .map(([, cid, unicode]) => [cid, String.fromCodePoint(...(unicode.match(/.{4}/gu) ?? []).map((part) => parseInt(part, 16)))])));
    }
    const content = page.node.Contents().asArray().map((ref) =>
      inflateSync(document.context.lookup(ref).getContents()).toString(),
    ).join("\n");
    const separators = [...content.matchAll(/54 ([\d.]+) m\s+54 [\d.]+ m\s+558 [\d.]+ l/gu)]
      .map(([, y]) => Number(y));
    const text = [...content.matchAll(/BT\s+([\s\S]*?)ET/gu)].map(([, operators]) => {
      const [, fontName, size] = /\/(NotoSerif(?:JP)?-[^\s]+) ([\d.]+) Tf/u.exec(operators) ?? [];
      const [, x, y] = /[-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ ([-\d.]+) ([-\d.]+) Tm/u.exec(operators) ?? [];
      const [, hex] = /<([0-9A-F]+)> Tj/u.exec(operators) ?? [];
      if (!hex) return null;
      const cmap = maps.get(`/${fontName}`);
      const value = (hex.match(/.{4}/gu) ?? []).map((cid) => cmap.get(cid)).join("");
      const [, family, weight] = /NotoSerif(JP)?-(Regular|Bold|Italic)-/u.exec(fontName);
      const style = `${family ? "Cjk" : ""}${weight}`;
      return {
        value, x: Number(x), y: Number(y), size: Number(size),
        width: fonts[style].widthOfTextAtSize(value, Number(size)),
        pageIndex,
      };
    }).filter(Boolean);
    const annotations = page.node.Annots()?.asArray().map((ref) => {
      const annotation = document.context.lookup(ref);
      const rect = document.context.lookup(annotation.get(PDFName.of("Rect"))).asArray().map((n) => n.asNumber());
      const action = document.context.lookup(annotation.get(PDFName.of("A")));
      return { rect, uri: action.get(PDFName.of("URI")).decodeText(), pageIndex };
    }) ?? [];
    return { text, annotations, separators };
  });
  return { pages, text: pages.flatMap((page) => page.text), annotations: pages.flatMap((page) => page.annotations) };
};

const expectWithinPage = ({ text, annotations }) => {
  for (const { x, y, width, size } of text) {
    expect(x).toBeGreaterThanOrEqual(54 - 0.1);
    expect(x + width).toBeLessThanOrEqual(558 + 0.1);
    expect(y).toBeGreaterThanOrEqual(54 - 0.1);
    expect(y + size).toBeLessThanOrEqual(738 + 0.1);
  }
  for (const { rect: [left, bottom, right, top] } of annotations) {
    expect(left).toBeGreaterThanOrEqual(54 - 0.1);
    expect(right).toBeLessThanOrEqual(558 + 0.1);
    expect(bottom).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThanOrEqual(792);
  }
};

describe("V17 Slice 04 Harvard PDF layout", () => {
  it("preserves Japanese and Vietnamese text in mixed-style PDF runs", async () => {
    const pdf = await inspectPdf(await renderHarvardCandidateCvPdf({
      personalInfo: { fullName: "Nguyễn 日本語" },
      professionalSummary: "Định dạng 日本語",
      professionalSummaryHtml: "<p>Định dạng <strong>日本語</strong> <em>日本語</em> <a href=\"https://example.com\">日本語</a></p>",
    }));
    const drawnText = pdf.text.map(({ value }) => value).join("");
    expect(drawnText).toContain("Nguyễn 日本語");
    expect(drawnText.replace(/\s/gu, "")).toContain("Địnhdạng日本語日本語日本語");
    expect(pdf.annotations).toHaveLength(1);
    expectWithinPage(pdf);
  });

  it("wraps Japanese long lines across pages without losing glyphs or links", async () => {
    const japanese = "日本語".repeat(90);
    const html = `<p><strong>${japanese}</strong> <em>${japanese}</em> <a href="https://example.com/japanese">${japanese}</a></p>`;
    const bytes = await renderHarvardCandidateCvPdf({
      personalInfo: { fullName: "Nguyễn 日本語" },
      professionalSummary: japanese,
      professionalSummaryHtml: html.repeat(5),
    });
    const pdf = await inspectPdf(bytes);
    const extracted = pdf.text.map(({ value }) => value).join("").replace(/\s/gu, "");
    expect(pdf.pages.length).toBeGreaterThan(1);
    expect((extracted.match(/日本語/gu) ?? []).length).toBe(90 * 3 * 5 + 1);
    expect(pdf.annotations.length).toBeGreaterThan(5);
    expect(pdf.annotations.every(({ uri }) => uri === "https://example.com/japanese")).toBe(true);
    expectWithinPage(pdf);
    if (process.env.V17_PDF_EVIDENCE_DIR) {
      mkdirSync(process.env.V17_PDF_EVIDENCE_DIR, { recursive: true });
      writeFileSync(join(process.env.V17_PDF_EVIDENCE_DIR, "new-unicode-multipage.pdf"), bytes);
    }
  });

  it("fails explicitly when neither embedded face covers a character", async () => {
    await expect(renderHarvardCandidateCvPdf({
      personalInfo: { fullName: "Candidate" },
      professionalSummary: "unsupported 😀",
    })).rejects.toThrow(/font coverage missing for U\+1F600/u);
  });

  it("captures a fresh Generated CV snapshot PDF with Unicode and Minimal formatting", async () => {
    const generatedContent = {
      personalInfo: { fullName: "Nguyễn 日本語" },
      professionalSummary: "Định dạng 日本語",
      professionalSummaryHtml: '<p><strong>Định dạng</strong> <em>日本語</em> <a href="https://example.com">liên kết</a></p>',
    };
    const { snapshot } = await captureCvSnapshot({
      candidateCv: { _id: "6ae8c3969ae0ebd4f487c1d5", name: "Unicode CV", sourceType: "GENERATED", generatedContent },
      capturedAt: new Date("2026-11-03T00:00:00Z"),
      storage: APPLICATION_CV_SNAPSHOT_STORAGE,
    });
    expect(snapshot.generatedContent).toEqual(generatedContent);
    expect(snapshot.pdfFile.pageCount).toBe(1);
    expect(snapshot.pdfFile.sizeBytes).toBe(snapshotUpload.buffer.length);
    expect(snapshot.pdfFile.storageKey).toBe("v17-unicode-snapshot-test");
    const pdf = await inspectPdf(snapshotUpload.buffer);
    expect(pdf.text.map(({ value }) => value).join("")).toContain("日本語");
    expect(pdf.annotations.length).toBeGreaterThan(0);
    expect(pdf.annotations.every(({ uri }) => uri === "https://example.com")).toBe(true);
    expectWithinPage(pdf);
    if (process.env.V17_PDF_EVIDENCE_DIR) {
      mkdirSync(process.env.V17_PDF_EVIDENCE_DIR, { recursive: true });
      writeFileSync(join(process.env.V17_PDF_EVIDENCE_DIR, "new-snapshot-capture.pdf"), snapshotUpload.buffer);
    }
  });

  it("wraps long header fields without losing text or moving lines outside the page", async () => {
    const name = "Nguyễn Văn Hùng ".repeat(12).trim();
    const contact = "very.long.email.address@example.com".repeat(7);
    const url = `https://example.com/${"long-path-segment".repeat(18)}`;
    const pdf = await inspectPdf(await renderHarvardCandidateCvPdf({
      personalInfo: { fullName: name, email: contact, links: [url] },
      professionalSummary: "Summary",
    }));
    expect(pdf.text.map(({ value }) => value).join(" ")).toContain("Summary");
    for (const source of [name, contact, url]) {
      const rendered = pdf.text.filter(({ value }) => source.includes(value)).map(({ value }) => value).join("");
      expect(rendered.replace(/\s/gu, "")).toBe(source.replace(/\s/gu, ""));
    }
    expect(pdf.text.filter(({ value }) => name.includes(value)).length).toBeGreaterThan(1);
    for (const line of pdf.text.filter(({ value }) => name.includes(value) || contact.includes(value) || url.includes(value))) {
      expect(Math.abs(line.x - (54 + (504 - line.width) / 2))).toBeLessThan(0.2);
    }
    expectWithinPage(pdf);
  });

  it("keeps a section heading, separator and first content line on the same page", async () => {
    const paragraphs = Array.from({ length: 44 }, (_, index) => `<p>Line ${index + 1}</p>`).join("");
    const pdf = await inspectPdf(await renderHarvardCandidateCvPdf({
      personalInfo: { fullName: "Test Person" },
      professionalSummary: "Summary text",
      professionalSummaryHtml: paragraphs,
      skills: ["First skill"],
    }));
    const heading = pdf.text.find(({ value }) => value === "SKILLS");
    const firstLine = pdf.text.find(({ value }) => value === "First skill");
    expect(pdf.pages.length).toBe(2);
    expect(heading.pageIndex).toBe(firstLine.pageIndex);
    expect(firstLine.y).toBeLessThan(heading.y);
    expect(pdf.pages[heading.pageIndex].separators.some((y) =>
      firstLine.y < y && y < heading.y,
    )).toBe(true);
    expectWithinPage(pdf);
  });

  it("keeps multipage nested lists, long links and mixed styles within bounds", async () => {
    const url = `https://example.com/${"rich-link-segment".repeat(22)}`;
    const html = `<ul><li><strong>Outer bold</strong><ol><li><em>Inner italic</em> <a href="${url}">linked label</a></li></ol></li></ul>`;
    const pdf = await inspectPdf(await renderHarvardCandidateCvPdf({
      personalInfo: { fullName: "Test Person" },
      professionalSummary: "Rich text",
      professionalSummaryHtml: `${"<p>Filler line</p>".repeat(42)}${html}`,
      workExperiences: [{ position: "Engineer", description: "Work detail", descriptionHtml: `<p><u>Work detail</u> <a href="${url}">more</a></p>` }],
    }));
    expect(pdf.pages.length).toBeGreaterThan(1);
    const drawnText = pdf.text.map(({ value }) => value).join("");
    expect(drawnText.replace(/\s+/gu, " ")).toContain("Outer bold");
    expect(drawnText.replace(/\s+/gu, " ")).toContain("Inner italic");
    expect(drawnText).toContain("• ");
    expect(drawnText).toContain("1. ");
    expect(drawnText).toContain(url);
    expect(pdf.annotations.length).toBeGreaterThan(1);
    expect(pdf.annotations.every(({ uri }) => uri === url)).toBe(true);
    expectWithinPage(pdf);
  });
});
