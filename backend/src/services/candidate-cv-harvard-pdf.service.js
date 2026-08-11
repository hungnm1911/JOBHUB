import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import HARVARD_CV_SECTION from "../constants/harvard-cv-section.js";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

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

// pdf-lib StandardFonts use WinAnsi; replace unsupported glyphs so incomplete
// Draft content still renders without failing the Preview path.
const toRenderableText = (value) => {
  if (value == null) {
    return "";
  }

  return String(value)
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\s+/g, " ")
    .trim();
};

const joinPresent = (parts, separator = " | ") => {
  return parts
    .map((part) => toRenderableText(part))
    .filter((part) => part !== "")
    .join(separator);
};

const wrapText = (text, font, fontSize, maxWidth) => {
  const normalized = toRenderableText(text);

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
  const regularFont = await pdfDocument.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdfDocument.embedFont(StandardFonts.TimesRomanBold);
  const italicFont = await pdfDocument.embedFont(StandardFonts.TimesRomanItalic);

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

  const drawCentered = ({ text, font, fontSize, lineHeight, gapAfter = 0 }) => {
    const line = toRenderableText(text);

    if (line === "") {
      return;
    }

    ensureSpace(lineHeight);
    const textWidth = font.widthOfTextAtSize(line, fontSize);
    page.drawText(line, {
      x: MARGIN_X + Math.max(0, (CONTENT_WIDTH - textWidth) / 2),
      y: cursorY - fontSize,
      size: fontSize,
      font,
      color: rgb(0.05, 0.05, 0.05),
    });
    cursorY -= lineHeight + gapAfter;
  };

  const drawSectionHeading = (title) => {
    ensureSpace(28);
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

  const fullName = toRenderableText(personalInfo.fullName) || "Candidate CV";
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
    .map((link) => toRenderableText(link))
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
      const summary = toRenderableText(content.professionalSummary);

      if (summary === "") {
        continue;
      }

      drawSectionHeading(section.title);
      drawLines({
        lines: wrapText(summary, regularFont, 10, CONTENT_WIDTH),
        font: regularFont,
        fontSize: 10,
        lineHeight: 13,
        gapAfter: 6,
      });
      continue;
    }

    if (section.id === HARVARD_CV_SECTION.SKILLS) {
      const skills = (content.skills ?? [])
        .map((skill) => toRenderableText(skill))
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
          drawLines({
            lines: wrapText(experience.description, regularFont, 10, CONTENT_WIDTH),
            font: regularFont,
            fontSize: 10,
            lineHeight: 13,
          });
        }

        for (const achievement of experience.achievements ?? []) {
          const text = toRenderableText(achievement);

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
          .map((item) => toRenderableText(item))
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
          drawLines({
            lines: wrapText(project.description, regularFont, 10, CONTENT_WIDTH),
            font: regularFont,
            fontSize: 10,
            lineHeight: 13,
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
