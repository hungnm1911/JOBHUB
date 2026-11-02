import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import { prepareOwnGeneratedCvBaseline } from "../../src/services/candidate-cv-optimization-baseline.service.js";
import { createGeneratedDraftCandidateCv } from "../../src/services/candidate-cv.service.js";
import { createVerifiedUser, loginAndGetAccessToken } from "../helpers/auth-fixtures.js";
import {
  clearDatabase, connectTestDatabase, createTestAgent, disconnectTestDatabase,
} from "../helpers/database.js";

describe("V17 Slice 03 — Generated CV Rich Text", () => {
  beforeAll(connectTestDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);

  const context = async (content = {}) => {
    const { user } = await createVerifiedUser({ email: "v17.cv@example.com" });
    const category = await Category.create({ name: "Engineering", level: "FIELD" });
    const cv = await CandidateCV.create({
      candidateUserId: user._id,
      name: "CV",
      sourceType: "GENERATED",
      status: "DRAFT",
      visibility: "PRIVATE",
      categoryId: category._id,
      generatedContent: content,
    });
    const agent = createTestAgent();
    const token = await loginAndGetAccessToken(agent, { email: user.email });
    const path = `/api/candidate/cvs/${cv._id}`;
    const save = (body) => agent.put(`${path}/generated-content`)
      .set("Authorization", `Bearer ${token}`).send(body);
    const read = () => agent.get(path).set("Authorization", `Bearer ${token}`);
    return { user, cv, save, read, agent, token, path };
  };

  it("sanitizes Minimal HTML, persists matching text, and exposes both on existing reads", async () => {
    const { cv, save, read } = await context({ professionalSummary: "Legacy <literal>" });
    const legacy = await read();
    expect(legacy.status).toBe(200);
    expect(legacy.body.cv.generatedContent).toMatchObject({
      professionalSummary: "Legacy <literal>", professionalSummaryHtml: null,
    });

    const response = await save({
      professionalSummary: "stale",
      professionalSummaryHtml: '<h2>Backend <strong>engineer</strong></h2><script>bad()</script>',
      workExperiences: [{ companyName: "Acme", descriptionHtml: '<p>Built <em>APIs</em></p>' }],
      projects: [{ name: "Ledger", descriptionHtml: '<p>Used <u>Node</u></p>' }],
    });
    expect(response.status).toBe(200);
    const content = response.body.cv.generatedContent;
    expect(content.professionalSummary).toBe("Backend engineer");
    expect(content.professionalSummaryHtml).toBe("<p>Backend <strong>engineer</strong></p>");
    expect(content.workExperiences[0]).toMatchObject({
      description: "Built APIs", descriptionHtml: "<p>Built <em>APIs</em></p>",
    });
    expect(content.projects[0]).toMatchObject({
      description: "Used Node", descriptionHtml: "<p>Used <u>Node</u></p>",
    });
    expect(content.professionalSummaryHtml).not.toContain("script");
    expect((await CandidateCV.findById(cv._id).lean()).generatedContent)
      .toMatchObject(content);
    expect((await read()).body.cv.generatedContent).toEqual(content);
  });

  it("normalizes server-supplied HTML during Generated Draft creation", async () => {
    const { user } = await createVerifiedUser({ email: "v17.cv.create@example.com" });
    const category = await Category.create({ name: "Engineering", level: "FIELD" });
    const created = await createGeneratedDraftCandidateCv({
      candidateUserId: user._id,
      actorUser: user,
      draft: { name: "Optimized", visibility: "PRIVATE", categoryId: category._id },
      generatedContent: {
        professionalSummary: "stale",
        professionalSummaryHtml: "<p>Created <strong>summary</strong></p>",
        workExperiences: [{ descriptionHtml: "<p>Created <em>work</em></p>" }],
      },
    });
    expect(created.status).toBe("DRAFT");
    expect(created.generatedContent).toMatchObject({
      professionalSummary: "Created summary",
      professionalSummaryHtml: "<p>Created <strong>summary</strong></p>",
      workExperiences: [{ description: "Created work", descriptionHtml: "<p>Created <em>work</em></p>" }],
    });
    expect((await CandidateCV.findById(created.id).lean()).generatedContent)
      .toMatchObject(created.generatedContent);
  });

  it("preserves untouched pairs on partial saves and clears only the edited plain field's HTML", async () => {
    const { cv, save } = await context();
    await save({
      professionalSummaryHtml: "<p>First <strong>summary</strong></p>",
      workExperiences: [
        { companyName: "A", descriptionHtml: "<p>First <em>job</em></p>" },
        { companyName: "B", descriptionHtml: "<p>Second <em>job</em></p>" },
      ],
      projects: [{ name: "P", descriptionHtml: "<p>First <u>project</u></p>" }],
    });
    const patched = await save({ workExperiences: [{ description: "Plain job" }, {}] });
    expect(patched.status).toBe(200);
    const content = patched.body.cv.generatedContent;
    expect(content.professionalSummaryHtml).toContain("<strong>");
    expect(content.workExperiences[0]).toMatchObject({
      companyName: "A", description: "Plain job", descriptionHtml: null,
    });
    expect(content.workExperiences[1].descriptionHtml).toContain("<em>");
    expect(content.projects[0].descriptionHtml).toContain("<u>");

    const plain = await save({ professionalSummary: "Plain <literal>" });
    expect(plain.status).toBe(200);
    expect(plain.body.cv.generatedContent).toMatchObject({
      professionalSummary: "Plain <literal>", professionalSummaryHtml: null,
    });
    expect((await CandidateCV.findById(cv._id).lean()).generatedContent
      .workExperiences[1].descriptionHtml).toContain("<em>");
  });

  it("uses meaningful text for completeness and keeps markup-only content incomplete", async () => {
    const { cv, save } = await context({
      personalInfo: { fullName: "Jane", email: "jane@example.com", phone: "123" },
      professionalSummary: "Old summary",
      educations: [{ institutionName: "University", degree: "BSc" }],
      skills: ["Node.js"],
    });
    const empty = await save({ professionalSummaryHtml: "<p><strong> </strong></p>" });
    expect(empty.status).toBe(200);
    expect(empty.body.completeness.isComplete).toBe(false);
    expect(empty.body.cv.generatedContent).toMatchObject({
      professionalSummary: null, professionalSummaryHtml: null,
    });
    expect(empty.body.cv.status).toBe("DRAFT");
    const complete = await save({ professionalSummaryHtml: "<p><em>New summary</em></p>" });
    expect(complete.body.completeness.isComplete).toBe(true);
    expect(complete.body.cv.status).toBe("DRAFT");
    expect((await CandidateCV.findById(cv._id).lean()).generatedContent.professionalSummary)
      .toBe("New summary");
  });

  it("demotes an ACTIVE default CV when an HTML-only summary has no meaningful text", async () => {
    const { cv, save, agent, token, path } = await context({
      personalInfo: { fullName: "Jane", email: "jane@example.com", phone: "123" },
      professionalSummary: "Summary",
      educations: [{ institutionName: "University", degree: "BSc" }],
      skills: ["Node.js"],
    });
    expect((await save({})).status).toBe(200);
    const activated = await agent.post(`${path}/activate`)
      .set("Authorization", `Bearer ${token}`);
    expect(activated.status, JSON.stringify(activated.body)).toBe(200);
    const setDefault = await agent.put(`${path}/default`)
      .set("Authorization", `Bearer ${token}`);
    expect(setDefault.status).toBe(200);

    const response = await save({ professionalSummaryHtml: "<p><em> </em></p>" });
    expect(response.status).toBe(200);
    expect(response.body.completeness.isComplete).toBe(false);
    expect(response.body.cv).toMatchObject({ status: "DRAFT", isDefault: false });
    expect(await CandidateCV.findById(cv._id).lean()).toMatchObject({
      status: "DRAFT", isDefault: false,
      generatedContent: { professionalSummary: null, professionalSummaryHtml: null },
    });
  });

  it("keeps AI-V06 career sections plain while retaining HTML in the source baseline", async () => {
    const { cv, user } = await context({
      professionalSummary: "Summary", professionalSummaryHtml: "<p>Summary</p>",
      workExperiences: [{ description: "Work", descriptionHtml: "<p>Work</p>" }],
      projects: [{ description: "Project", descriptionHtml: "<p>Project</p>" }],
    });
    const baseline = await prepareOwnGeneratedCvBaseline({
      actorUser: user, candidateUserId: user._id, candidateCvId: cv._id.toString(),
    });
    expect(baseline.generatedContent.professionalSummaryHtml).toBe("<p>Summary</p>");
    expect(baseline.careerSections.workExperiences[0]).not.toHaveProperty("descriptionHtml");
    expect(baseline.careerSections.projects[0]).not.toHaveProperty("descriptionHtml");
    expect(JSON.stringify(baseline.careerSections)).not.toContain("Html");
  });
});
