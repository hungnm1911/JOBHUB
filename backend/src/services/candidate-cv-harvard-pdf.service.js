import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import fontkit from "@pdf-lib/fontkit";
import { convert } from "html-to-text";
import { PDFDocument, PDFName, PDFString, degrees, rgb } from "pdf-lib";

import HARVARD_CV_SECTION from "../constants/harvard-cv-section.js";
import { normalizeRichText } from "./rich-text.service.js";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const FONT_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../assets/fonts/noto-serif",
);

const HARVARD_FONT_FILES = Object.freeze({
  regular: join(FONT_DIRECTORY, "NotoSerif-Regular.ttf"),
  bold: join(FONT_DIRECTORY, "NotoSerif-Bold.ttf"),
  italic: join(FONT_DIRECTORY, "NotoSerif-Italic.ttf"),
});

const SECTION_ORDER = Object.freeze([
  {
    id: HARVARD_CV_SECTION.PROFESSIONAL_SUMMARY,
    title: "Professional Summary",
  },
  {
    id: HARVARD_CV_SECTION.EDUCATIONS,
    title: "Education",
  },
  {
    id: HARVARD_CV_SECTION.SKILLS,
    title: "Skills",
  },
  {
    id: HARVARD_CV_SECTION.WORK_EXPERIENCES,
    title: "Work Experience",
  },
  {
    id: HARVARD_CV_SECTION.PROJECTS,
    title: "Projects",
  },
  {
    id: HARVARD_CV_SECTION.CERTIFICATIONS,
    title: "Certifications",
  },
  {
    id: HARVARD_CV_SECTION.LANGUAGES,
    title: "Languages",
  },
]);

const hasPresentString = (value) => {
  return typeof value === "string" && value.trim() !== "";
};

// Preserve valid Unicode from generatedContent; only normalize whitespace for layout.
const toDisplayText = (value) => {
  if (value == null) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
};

const joinPresent = (parts, separator = " | ") => {
  return parts
    .map((part) => toDisplayText(part))
    .filter((part) => part !== "")
    .join(separator);
};

const wrapText = (text, font, fontSize, maxWidth) => {
  const normalized = toDisplayText(text);

  if (normalized === "") {
    return [];
  }

  const words = normalized.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine === "" ? word : `${currentLine} ${word}`;

    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine !== "") {
      lines.push(currentLine);
    }

    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      currentLine = word;
      continue;
    }

    let chunk = "";

    for (const character of word) {
      const nextChunk = `${chunk}${character}`;

      if (font.widthOfTextAtSize(nextChunk, fontSize) <= maxWidth) {
        chunk = nextChunk;
      } else {
        if (chunk !== "") {
          lines.push(chunk);
        }

        chunk = character;
      }
    }

    currentLine = chunk;
  }

  if (currentLine !== "") {
    lines.push(currentLine);
  }

  return lines;
};

// The stored HTML has the Minimal vocabulary. Normalize it again on read so
// legacy or externally written content cannot introduce PDF layout commands.
const richBlocks = (html) => {
  const safeHtml = normalizeRichText(html, "minimal").html;
  const blocks = [];
  let runs = [];
  const styles = [];
  const lists = [];
  let anchor = null;
  const listLabel = (list) => {
    if (!list?.ordered) return "•";
    const value = list.index++;
    if ((list.type === "a" || list.type === "A") && value > 0 && value < 10000) {
      let number = value;
      let letters = "";
      while (number > 0) {
        number -= 1;
        letters = String.fromCharCode(97 + number % 26) + letters;
        number = Math.floor(number / 26);
      }
      return list.type === "A" ? letters.toUpperCase() : letters;
    }
    if ((list.type === "i" || list.type === "I") && value > 0 && value < 4000) {
      let number = value;
      let roman = "";
      for (const [amount, symbol] of [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]) {
        while (number >= amount) {
          roman += symbol;
          number -= amount;
        }
      }
      return list.type === "i" ? roman.toLowerCase() : roman;
    }
    return String(value);
  };

  const flush = () => {
    if (runs.some((run) => run.text.trim())) blocks.push(runs);
    runs = [];
  };
  const append = (text) => {
    if (!text) return;
    runs.push({
      text,
      bold: styles.includes("strong"),
      italic: styles.includes("em"),
      underline: styles.includes("u") || anchor != null,
      href: anchor?.href,
    });
    if (anchor != null) anchor.label += text;
  };

  for (const token of safeHtml.match(/<[^>]*>|[^<]+/gu) ?? []) {
    if (!token.startsWith("<")) {
      const decoded = convert(token, { wordwrap: false });
      append(`${/^\s/u.test(token) ? " " : ""}${decoded}${/\s$/u.test(token) ? " " : ""}`);
      continue;
    }

    const match = /^<\s*(\/)?\s*([a-z]+)\b([^>]*)>/iu.exec(token);
    if (!match) continue;
    const [, closing, rawTag, attributes] = match;
    const tag = rawTag.toLowerCase();

    if (["strong", "em", "u"].includes(tag)) {
      if (closing) {
        if (styles.includes(tag)) styles.splice(styles.lastIndexOf(tag), 1);
      } else {
        styles.push(tag);
      }
    } else if (tag === "a") {
      if (closing && anchor) {
        const { href, label } = anchor;
        anchor = null;
        if (href && label.trim() !== href) append(` (${href})`);
      } else if (!closing) {
        const href = /\bhref="([^"]+)"/iu.exec(attributes)?.[1];
        anchor = { href: href ? convert(href, { wordwrap: false }) : null, label: "" };
      }
    } else if (tag === "ul" || tag === "ol") {
      flush();
      if (closing) lists.pop();
      else lists.push({
        ordered: tag === "ol",
        index: Number(/\bstart="([+-]?\d+)"/iu.exec(attributes)?.[1] ?? 1),
        type: /\btype="([1aAiI])"/u.exec(attributes)?.[1] ?? "1",
      });
    } else if (tag === "li" && !closing) {
      flush();
      const list = lists.at(-1);
      append(list?.ordered ? `${listLabel(list)}. ` : "• ");
    } else if (tag === "p" || tag === "br" || (tag === "li" && closing)) {
      if (tag !== "p" || closing) flush();
    }
  }
  flush();
  return blocks;
};

const loadHarvardFonts = async (pdfDocument) => {
  pdfDocument.registerFontkit(fontkit);

  const [regularFont, boldFont, italicFont] = await Promise.all([
    pdfDocument.embedFont(readFileSync(HARVARD_FONT_FILES.regular), {
      subset: true,
    }),
    pdfDocument.embedFont(readFileSync(HARVARD_FONT_FILES.bold), {
      subset: true,
    }),
    pdfDocument.embedFont(readFileSync(HARVARD_FONT_FILES.italic), {
      subset: true,
    }),
  ]);

  return {
    regularFont,
    boldFont,
    italicFont,
  };
};

/**
 * Fixed Harvard Template PDF renderer for Generated CandidateCV content.
 * Canonical source remains generatedContent; this never persists PDF bytes.
 */
const renderHarvardCandidateCvPdf = async (generatedContent = {}) => {
  const content = generatedContent ?? {};
  const personalInfo = content.personalInfo ?? {};
  const hiddenSections = new Set(
    (content.hiddenSections ?? []).filter((section) =>
      typeof section === "string",
    ),
  );

  const pdfDocument = await PDFDocument.create();
  const { regularFont, boldFont, italicFont } =
    await loadHarvardFonts(pdfDocument);

  let page = pdfDocument.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN_TOP;

  const ensureSpace = (neededHeight) => {
    if (cursorY - neededHeight >= MARGIN_BOTTOM) {
      return;
    }

    page = pdfDocument.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = PAGE_HEIGHT - MARGIN_TOP;
  };

  const drawLines = ({
    lines,
    font,
    fontSize,
    lineHeight,
    color = rgb(0.1, 0.1, 0.1),
    gapAfter = 0,
  }) => {
    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, {
        x: MARGIN_X,
        y: cursorY - fontSize,
        size: fontSize,
        font,
        color,
      });
      cursorY -= lineHeight;
    }

    cursorY -= gapAfter;
  };

  const drawRichText = ({ html, plainText, gapAfter = 0 }) => {
    if (!hasPresentString(plainText)) return;
    const blocks = hasPresentString(html) ? richBlocks(html) : [];
    if (blocks.length === 0) {
      drawLines({
        lines: wrapText(plainText, regularFont, 10, CONTENT_WIDTH),
        font: regularFont,
        fontSize: 10,
        lineHeight: 13,
        gapAfter,
      });
      return;
    }

    for (const runs of blocks) {
      let lineWidth = 0;
      let hasText = false;
      const nextLine = () => {
        cursorY -= 13;
        lineWidth = 0;
        hasText = false;
      };

      for (const run of runs) {
        const font = run.bold ? boldFont : run.italic ? italicFont : regularFont;
        const color = run.href ? rgb(0.12, 0.28, 0.58) : rgb(0.1, 0.1, 0.1);
        for (const piece of run.text.match(/\s+|\S+/gu) ?? []) {
          const space = /^\s+$/u.test(piece);
          if (space && !hasText) continue;
          const text = space ? " " : piece;
          const width = font.widthOfTextAtSize(text, 10);
          if (!space && hasText && lineWidth + width > CONTENT_WIDTH) nextLine();
          if (space && lineWidth + width > CONTENT_WIDTH) {
            nextLine();
            continue;
          }

          // Long URLs and words use the same character fallback as plain text.
          const chunks = width > CONTENT_WIDTH
            ? wrapText(text, font, 10, CONTENT_WIDTH)
            : [text];
          for (const [index, chunk] of chunks.entries()) {
            if (index > 0) nextLine();
            ensureSpace(13);
            const x = MARGIN_X + lineWidth;
            const y = cursorY - 10;
            page.drawText(chunk, {
              x, y, size: 10, font, color,
              ...(run.bold && run.italic && { xSkew: degrees(12) }),
            });
            const chunkWidth = font.widthOfTextAtSize(chunk, 10);
            if (run.underline) {
              page.drawLine({
                start: { x, y: y - 1 },
                end: { x: x + chunkWidth, y: y - 1 },
                thickness: 0.5,
                color,
              });
            }
            if (run.href && !space) {
              const annotation = pdfDocument.context.obj({
                Type: PDFName.of("Annot"),
                Subtype: PDFName.of("Link"),
                Rect: [x, y - 2, x + chunkWidth, y + 11],
                Border: [0, 0, 0],
                A: pdfDocument.context.obj({
                  S: PDFName.of("URI"),
                  URI: PDFString.of(run.href),
                }),
              });
              page.node.addAnnot(pdfDocument.context.register(annotation));
            }
            lineWidth += chunkWidth;
            hasText = true;
          }
        }
      }
      if (hasText) nextLine();
    }
    cursorY -= gapAfter;
  };

  const drawCentered = ({ text, font, fontSize, lineHeight, gapAfter = 0 }) => {
    const lines = wrapText(text, font, fontSize, CONTENT_WIDTH);
    for (const line of lines) {
      ensureSpace(lineHeight);
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      page.drawText(line, {
        x: MARGIN_X + (CONTENT_WIDTH - textWidth) / 2,
        y: cursorY - fontSize,
        size: fontSize,
        font,
        color: rgb(0.05, 0.05, 0.05),
      });
      cursorY -= lineHeight;
    }
    if (lines.length > 0) cursorY -= gapAfter;
  };

  const drawSectionHeading = (title) => {
    // 8 before the title, 14 through the separator, 10 after it, then a first line.
    ensureSpace(32 + 13);
    cursorY -= 8;
    page.drawText(title.toUpperCase(), {
      x: MARGIN_X,
      y: cursorY - 11,
      size: 11,
      font: boldFont,
      color: rgb(0.05, 0.05, 0.05),
    });
    cursorY -= 14;
    page.drawLine({
      start: { x: MARGIN_X, y: cursorY },
      end: { x: PAGE_WIDTH - MARGIN_X, y: cursorY },
      thickness: 0.8,
      color: rgb(0.2, 0.2, 0.2),
    });
    cursorY -= 10;
  };

  const fullName = toDisplayText(personalInfo.fullName) || "Candidate CV";
  drawCentered({
    text: fullName,
    font: boldFont,
    fontSize: 20,
    lineHeight: 24,
    gapAfter: 4,
  });

  const contactLine = joinPresent([
    personalInfo.email,
    personalInfo.phone,
    personalInfo.displayLocation,
  ]);

  if (contactLine !== "") {
    drawCentered({
      text: contactLine,
      font: regularFont,
      fontSize: 10,
      lineHeight: 13,
      gapAfter: 2,
    });
  }

  const links = (personalInfo.links ?? [])
    .map((link) => toDisplayText(link))
    .filter((link) => link !== "");

  if (links.length > 0) {
    drawCentered({
      text: links.join(" | "),
      font: italicFont,
      fontSize: 9,
      lineHeight: 12,
      gapAfter: 8,
    });
  } else {
    cursorY -= 6;
  }

  for (const section of SECTION_ORDER) {
    if (hiddenSections.has(section.id)) {
      continue;
    }

    if (section.id === HARVARD_CV_SECTION.PROFESSIONAL_SUMMARY) {
      const summary = toDisplayText(content.professionalSummary);

      if (summary === "") {
        continue;
      }

      drawSectionHeading(section.title);
      drawRichText({
        html: content.professionalSummaryHtml,
        plainText: summary,
        gapAfter: 6,
      });
      continue;
    }

    if (section.id === HARVARD_CV_SECTION.SKILLS) {
      const skills = (content.skills ?? [])
        .map((skill) => toDisplayText(skill))
        .filter((skill) => skill !== "");

      if (skills.length === 0) {
        continue;
      }

      drawSectionHeading(section.title);
      drawLines({
        lines: wrapText(skills.join(", "), regularFont, 10, CONTENT_WIDTH),
        font: regularFont,
        fontSize: 10,
        lineHeight: 13,
        gapAfter: 6,
      });
      continue;
    }

    if (section.id === HARVARD_CV_SECTION.EDUCATIONS) {
      const educations = content.educations ?? [];

      if (educations.length === 0) {
        continue;
      }

      drawSectionHeading(section.title);

      for (const education of educations) {
        const headline = joinPresent(
          [education.institutionName, education.degree, education.fieldOfStudy],
          ", ",
        );
        const dates = joinPresent([education.startDate, education.endDate], " - ");

        if (headline !== "") {
          drawLines({
            lines: wrapText(headline, boldFont, 10, CONTENT_WIDTH),
            font: boldFont,
            fontSize: 10,
            lineHeight: 13,
          });
        }

        if (dates !== "") {
          drawLines({
            lines: [dates],
            font: italicFont,
            fontSize: 9,
            lineHeight: 12,
            gapAfter: 4,
          });
        } else {
          cursorY -= 4;
        }
      }

      continue;
    }

    if (section.id === HARVARD_CV_SECTION.WORK_EXPERIENCES) {
      const experiences = content.workExperiences ?? [];

      if (experiences.length === 0) {
        continue;
      }

      drawSectionHeading(section.title);

      for (const experience of experiences) {
        const headline = joinPresent(
          [experience.position, experience.companyName],
          " — ",
        );
        const dates = joinPresent(
          [experience.startDate, experience.endDate],
          " - ",
        );

        if (headline !== "") {
          drawLines({
            lines: wrapText(headline, boldFont, 10, CONTENT_WIDTH),
            font: boldFont,
            fontSize: 10,
            lineHeight: 13,
          });
        }

        if (dates !== "") {
          drawLines({
            lines: [dates],
            font: italicFont,
            fontSize: 9,
            lineHeight: 12,
          });
        }

        if (hasPresentString(experience.description)) {
          drawRichText({
            html: experience.descriptionHtml,
            plainText: experience.description,
          });
        }

        for (const achievement of experience.achievements ?? []) {
          const text = toDisplayText(achievement);

          if (text === "") {
            continue;
          }

          drawLines({
            lines: wrapText(`• ${text}`, regularFont, 10, CONTENT_WIDTH),
            font: regularFont,
            fontSize: 10,
            lineHeight: 13,
          });
        }

        cursorY -= 4;
      }

      continue;
    }

    if (section.id === HARVARD_CV_SECTION.PROJECTS) {
      const projects = content.projects ?? [];

      if (projects.length === 0) {
        continue;
      }

      drawSectionHeading(section.title);

      for (const project of projects) {
        const headline = joinPresent([project.name, project.role], " — ");

        if (headline !== "") {
          drawLines({
            lines: wrapText(headline, boldFont, 10, CONTENT_WIDTH),
            font: boldFont,
            fontSize: 10,
            lineHeight: 13,
          });
        }

        const technologies = (project.technologies ?? [])
          .map((item) => toDisplayText(item))
          .filter((item) => item !== "");

        if (technologies.length > 0) {
          drawLines({
            lines: wrapText(
              `Technologies: ${technologies.join(", ")}`,
              italicFont,
              9,
              CONTENT_WIDTH,
            ),
            font: italicFont,
            fontSize: 9,
            lineHeight: 12,
          });
        }

        if (hasPresentString(project.description)) {
          drawRichText({
            html: project.descriptionHtml,
            plainText: project.description,
          });
        }

        if (hasPresentString(project.projectUrl)) {
          drawLines({
            lines: wrapText(project.projectUrl, italicFont, 9, CONTENT_WIDTH),
            font: italicFont,
            fontSize: 9,
            lineHeight: 12,
          });
        }

        cursorY -= 4;
      }

      continue;
    }

    if (section.id === HARVARD_CV_SECTION.CERTIFICATIONS) {
      const certifications = content.certifications ?? [];

      if (certifications.length === 0) {
        continue;
      }

      drawSectionHeading(section.title);

      for (const certification of certifications) {
        const headline = joinPresent(
          [certification.name, certification.issuer],
          " — ",
        );
        const dates = joinPresent(
          [certification.issueDate, certification.expirationDate],
          " - ",
        );
        const credential = joinPresent([
          certification.credentialId,
          certification.credentialUrl,
        ]);

        if (headline !== "") {
          drawLines({
            lines: wrapText(headline, boldFont, 10, CONTENT_WIDTH),
            font: boldFont,
            fontSize: 10,
            lineHeight: 13,
          });
        }

        if (dates !== "") {
          drawLines({
            lines: [dates],
            font: italicFont,
            fontSize: 9,
            lineHeight: 12,
          });
        }

        if (credential !== "") {
          drawLines({
            lines: wrapText(credential, regularFont, 9, CONTENT_WIDTH),
            font: regularFont,
            fontSize: 9,
            lineHeight: 12,
          });
        }

        cursorY -= 4;
      }

      continue;
    }

    if (section.id === HARVARD_CV_SECTION.LANGUAGES) {
      const languages = content.languages ?? [];

      if (languages.length === 0) {
        continue;
      }

      drawSectionHeading(section.title);

      const languageLine = languages
        .map((language) =>
          joinPresent([language.name, language.proficiency], " — "),
        )
        .filter((line) => line !== "")
        .join("; ");

      if (languageLine !== "") {
        drawLines({
          lines: wrapText(languageLine, regularFont, 10, CONTENT_WIDTH),
          font: regularFont,
          fontSize: 10,
          lineHeight: 13,
          gapAfter: 6,
        });
      }
    }
  }

  return Buffer.from(await pdfDocument.save());
};

export { renderHarvardCandidateCvPdf };
