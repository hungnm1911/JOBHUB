import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { renderHarvardCandidateCvPdf } from "../../src/services/candidate-cv-harvard-pdf.service.js";

const fontPaths = {
  Regular: new URL("../../assets/fonts/noto-serif/NotoSerif-Regular.ttf", import.meta.url),
  Bold: new URL("../../assets/fonts/noto-serif/NotoSerif-Bold.ttf", import.meta.url),
  Italic: new URL("../../assets/fonts/noto-serif/NotoSerif-Italic.ttf", import.meta.url),
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
      const [, fontName, size] = /\/(NotoSerif-[^\s]+) ([\d.]+) Tf/u.exec(operators) ?? [];
      const [, x, y] = /1 0 0 1 ([\d.]+) ([\d.]+) Tm/u.exec(operators) ?? [];
      const [, hex] = /<([0-9A-F]+)> Tj/u.exec(operators) ?? [];
      if (!hex) return null;
      const cmap = maps.get(`/${fontName}`);
      const value = (hex.match(/.{4}/gu) ?? []).map((cid) => cmap.get(cid)).join("");
      const style = /NotoSerif-(Regular|Bold|Italic)-/u.exec(fontName)[1];
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
