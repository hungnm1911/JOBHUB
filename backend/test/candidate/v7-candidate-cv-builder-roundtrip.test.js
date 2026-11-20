import { PDFDocument, PDFName, decodePDFRawStream } from "pdf-lib";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import { renderHarvardCandidateCvPdf } from "../../src/services/candidate-cv-harvard-pdf.service.js";
import { createVerifiedUser, loginAndGetAccessToken } from "../helpers/auth-fixtures.js";
import { clearDatabase, connectTestDatabase, createTestAgent, disconnectTestDatabase } from "../helpers/database.js";

// Decode the renderer's embedded subset fonts so assertions cover visible PDF
// text, rather than only a successful response or a non-empty PDF buffer.
const pdfText = async (buffer) => {
  const pdf = await PDFDocument.load(buffer);
  const lines = [];
  for (const page of pdf.getPages()) {
    const fonts = page.node.Resources().lookup(PDFName.of("Font"));
    const maps = new Map();
    for (const name of fonts.keys()) {
      const cmap = new TextDecoder().decode(decodePDFRawStream(fonts.lookup(name).lookup(PDFName.of("ToUnicode"))).decode());
      maps.set(name.toString(), new Map([...cmap.matchAll(/<([\da-f]{4})>\s+<([\da-f]+)>/giu)].map(([, glyph, unicode]) => [
        glyph.toUpperCase(), String.fromCharCode(...unicode.match(/.{4}/gu).map((code) => parseInt(code, 16))),
      ])));
    }
    const contents = page.node.Contents();
    for (let index = 0; index < contents.size(); index += 1) {
      const operators = new TextDecoder().decode(decodePDFRawStream(pdf.context.lookup(contents.get(index))).decode());
      let font;
      for (const match of operators.matchAll(/(\/\S+) [\d.]+ Tf|<([\da-f]+)> Tj/giu)) {
        if (match[1]) font = maps.get(match[1]);
        else lines.push(match[2].match(/.{4}/gu).map((glyph) => font.get(glyph.toUpperCase()) ?? "").join(""));
      }
    }
  }
  return lines.join(" ");
};

const content = () => ({
  personalInfo: { fullName: "Nguyễn Văn Demo", email: "demo@example.com", phone: "0901234567" },
  professionalSummary: "Frontend developer",
  educations: [{ institutionName: "HUST", degree: "Bachelor", startDate: "2022-11-10", endDate: "2026-11-15" }],
  skills: ["React"],
  workExperiences: [{ companyName: "Work marker", position: "Intern", startDate: "2026-02-20", endDate: null, description: "Work description", achievements: ["Achievement marker"] }],
  projects: [{ name: "Project marker", role: "Developer", technologies: ["Vue", "SQL"], description: "Project description", projectUrl: "https://project.example" }],
  certifications: [{ name: "IELTS", issuer: "British Council", issueDate: "2026-08-12", expirationDate: "2028-08-12", credentialId: "ABC-12345", credentialUrl: "https://certificate.example" }],
  languages: [{ name: "English", proficiency: "FLUENT" }],
  hiddenSections: [],
});

describe("V7 Builder create/edit/read/preview round trip", () => {
  beforeAll(connectTestDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);

  it.each(["SAVE_DRAFT", "COMPLETE"])("retains metadata and all extended content through %s, edit and preview", async (creationIntent) => {
    const { user } = await createVerifiedUser({ email: "builder.roundtrip@example.com" });
    const field = await Category.create({ name: "Engineering", level: "FIELD" });
    const position = await Category.create({ name: "Frontend Engineer", level: "POSITION", parentCategoryId: field._id });
    const experience = await ExperienceLevel.create({ code: "UNDER_1_YEAR" });
    const agent = createTestAgent();
    const token = await loginAndGetAccessToken(agent, { email: user.email });
    const auth = { Authorization: `Bearer ${token}` };
    const created = await agent.post("/api/candidate/cvs").set(auth).send({
      name: "Builder CV", visibility: "PRIVATE", categoryId: position.id,
      experienceLevelId: experience.id, creationIntent, generatedContent: content(),
    });
    expect(created.status).toBe(201);
    const path = `/api/candidate/cvs/${created.body.cv.id}`;
    const metadata = await agent.patch(path).set(auth).send({ name: "Edited CV", categoryId: position.id, experienceLevelId: experience.id });
    expect(metadata.status).toBe(200);
    const editedContent = structuredClone(created.body.cv.generatedContent);
    editedContent.projects[0].description = "Edited project description";
    const saved = await agent.put(`${path}/generated-content`).set(auth).send(editedContent);
    expect(saved.status).toBe(200);
    const read = await agent.get(path).set(auth);
    expect(read.body.cv).toMatchObject({ name: "Edited CV", categoryId: position.id, experienceLevelId: experience.id, generatedContent: editedContent });
    const list = await agent.get("/api/candidate/cvs").set(auth);
    expect(list.body.cvs[0]).toMatchObject({ categoryId: position.id, experienceLevelId: experience.id });
    const stored = await CandidateCV.findById(created.body.cv.id).lean();
    expect(stored.generatedContent.projects[0].description).toBe("Edited project description");
    const preview = await agent.get(`${path}/preview`).set(auth).buffer(true).parse((res, callback) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    });
    expect(preview.status).toBe(200);
    const text = await pdfText(preview.body);
    for (const value of ["Work marker", "Work description", "Achievement marker", "Project marker", "Edited project description", "Vue, SQL", "https://project.example", "IELTS", "British Council", "ABC-12345", "https://certificate.example", "English", "FLUENT"]) {
      expect(text).toContain(value);
    }
    expect(text).toContain("10/11/2022");
    expect(text).toContain("12/08/2028");
    expect(text).not.toMatch(/GMT|Indochina|Coordinated/);
  });

  it("renders extended sections across pages and hides only sections explicitly selected", async () => {
    const source = content();
    source.workExperiences[0].description = "Long work description. ".repeat(220);
    const full = await renderHarvardCandidateCvPdf(source);
    expect((await PDFDocument.load(full)).getPageCount()).toBeGreaterThan(1);
    const fullText = await pdfText(full);
    expect(fullText).toContain("Project marker");
    expect(fullText).toContain("English");
    source.hiddenSections = ["projects", "languages"];
    const hiddenText = await pdfText(await renderHarvardCandidateCvPdf(source));
    expect(hiddenText).not.toContain("Project marker");
    expect(hiddenText).not.toContain("English");
    expect(hiddenText).toContain("Work marker");
    expect(hiddenText).toContain("IELTS");
    expect(source.projects).toHaveLength(1);
    expect(source.languages).toHaveLength(1);
  });
});
