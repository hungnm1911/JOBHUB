import { describe, expect, it } from "vitest";

import { buildCvQueryText } from "../src/recommendation/cv-query-text.js";

const ready = {
  status: "READY",
  profile: {
    source: { type: "GENERATED_CV", candidateCvId: "cv-secret" },
    metadata: {
      category: { value: { name: "Software Engineering" } },
      skillTags: [{ value: "Node.js", sourcePath: "/skillTags/0" }],
    },
    freeText: { professionalSummary: {
      value: "Build APIs. Email me at private@example.com",
      sourcePath: "/generatedContent/professionalSummary",
    } },
    content: {
      skills: [{ value: "MongoDB", sourcePath: "/generatedContent/skills/0" }],
      workExperiences: [], projects: [], educations: [], certifications: [], languages: [],
    },
  },
};

describe("AI-V05 CV query text", () => {
  it("uses career content from a READY profile without identity or contact tokens", () => {
    const queryText = buildCvQueryText(ready);
    expect(queryText).toContain("Career Target: Software Engineering");
    expect(queryText).toContain("Skill Tags: Node.js");
    expect(queryText).toContain("Skills: MongoDB");
    expect(queryText).not.toMatch(/cv-secret|sourcePath|private@example.com/);
    expect(buildCvQueryText(ready)).toBe(queryText);
  });

  it("requires a READY profile", () => {
    expect(() => buildCvQueryText({ status: "FAILED", profile: null })).toThrow(TypeError);
  });

  it("excludes dedicated contact and link fields while retaining career text", () => {
    const result = {
      ...ready,
      profile: {
        ...ready.profile,
        content: {
          ...ready.profile.content,
          links: [{ value: "https://portfolio.example.com", sourcePath: "/personalInfo/links/0" }],
          projects: [{
            sourcePath: "/projects/0",
            role: { value: "Backend Engineer", sourcePath: "/projects/0/role" },
            projectUrl: { value: "https://project.example.com", sourcePath: "/projects/0/projectUrl" },
          }],
          certifications: [{
            sourcePath: "/certifications/0",
            name: { value: "Cloud Architecture", sourcePath: "/certifications/0/name" },
            credentialUrl: { value: "https://certificate.example.com", sourcePath: "/certifications/0/credentialUrl" },
          }],
        },
      },
    };

    const queryText = buildCvQueryText(result);
    expect(queryText).toContain("Backend Engineer");
    expect(queryText).toContain("Cloud Architecture");
    expect(queryText).not.toMatch(/portfolio\.example|project\.example|certificate\.example|personalInfo/);
  });

  it("reads Uploaded CV career claims through the shared profile view", () => {
    const pdfContent = Object.fromEntries([
      "careerPositioning", "professionalSummary", "skills", "workExperiences",
      "projects", "educations", "certifications", "languages",
      "otherCareerClaims", "unresolvedContent",
    ].map((group) => [group, []]));
    pdfContent.skills = [{ value: "Kubernetes", evidence: [] }];
    const result = {
      status: "READY",
      profile: {
        source: { type: "UPLOADED_CV", candidateCvId: "private-id" },
        metadata: ready.profile.metadata,
        pdfContent,
      },
    };
    expect(buildCvQueryText(result)).toContain("Skills: Kubernetes");
    expect(buildCvQueryText(result)).not.toContain("private-id");
  });
});
