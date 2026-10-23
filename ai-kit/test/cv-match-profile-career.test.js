import { describe, expect, it } from "vitest";

import { readCvCareerContent } from "../src/normalization/cv-match-profile-career.js";
import { normalizeGeneratedCv } from "../src/normalization/cv-normalization.js";
import { composeUploadedCvProfile } from "../src/normalization/uploaded-cv-normalization.js";

const metadata = {
  candidateCvId: "cv-1",
  categoryId: "position-1",
  experienceLevelId: null,
  skillTags: ["nodejs"],
  employmentTypes: [],
  workModes: [],
  preferredLocations: [],
  taxonomy: {
    category: {
      id: "position-1",
      name: "Backend Developer",
      level: "POSITION",
      parentCategoryId: "field-1",
    },
    experienceLevel: null,
  },
};

const generatedSource = {
  ...metadata,
  generatedContent: {
    personalInfo: { links: [] },
    professionalSummary: "Backend developer",
    skills: ["Node.js", "Node.js"],
    workExperiences: [
      {
        companyName: "JOBHUB",
        position: "Engineer",
        startDate: "2020-01-01T00:00:00.000Z",
        endDate: null,
        description: "Built APIs",
        achievements: ["Built APIs"],
      },
    ],
    projects: [],
    educations: [],
    certifications: [],
    languages: [],
    hiddenSections: [],
  },
};

const pdfText = "Backend developer. Node.js. JOBHUB Engineer 2020 to present. Built APIs. Three years Python. Five years Python. Maybe cloud work.";
const pdfExtraction = {
  careerPositioning: [],
  professionalSummary: [{ value: "Backend developer", evidence: ["Backend developer"] }],
  skills: [{ value: "Node.js", evidence: ["Node.js"] }],
  workExperiences: [
    {
      companyName: "JOBHUB",
      position: "Engineer",
      period: "2020 to present",
      description: "Built APIs",
      achievements: ["Built APIs"],
      evidence: ["JOBHUB Engineer 2020 to present. Built APIs"],
    },
  ],
  projects: [],
  educations: [],
  certifications: [],
  languages: [],
  otherCareerClaims: [
    { value: "Three years Python", evidence: ["Three years Python"] },
    { value: "Five years Python", evidence: ["Five years Python"] },
  ],
  unresolvedContent: [{ value: "Maybe cloud work", evidence: ["Maybe cloud work"] }],
};

describe("CVMatchProfile shared career read contract", () => {
  it("lets one consumer read both variants with the same groups and item fields", () => {
    const generated = normalizeGeneratedCv(generatedSource);
    const uploaded = composeUploadedCvProfile({
      cvSource: metadata,
      extractedText: pdfText,
      pdfExtractionOutput: JSON.stringify(pdfExtraction),
    });

    expect(generated.status).toBe("READY");
    expect(uploaded.status).toBe("READY");
    expect(generated.profile.metadata).toEqual(uploaded.profile.metadata);

    const views = [generated.profile, uploaded.profile].map(readCvCareerContent);
    const [fromGenerated, fromUploaded] = views;

    expect(Object.keys(fromGenerated)).toEqual(Object.keys(fromUploaded));
    expect(fromGenerated.professionalSummary[0].value).toBe("Backend developer");
    expect(fromUploaded.professionalSummary[0].value).toBe("Backend developer");
    expect(fromGenerated.skills.map(({ value }) => value)).toEqual(["Node.js", "Node.js"]);
    expect(fromUploaded.skills.map(({ value }) => value)).toEqual(["Node.js"]);
    expect(Object.keys(fromGenerated.workExperiences[0].value)).toEqual(
      Object.keys(fromUploaded.workExperiences[0].value),
    );
    expect(fromGenerated.workExperiences[0].value).toMatchObject({
      companyName: "JOBHUB",
      startDate: "2020-01-01T00:00:00.000Z",
      period: null,
      description: "Built APIs",
      achievements: ["Built APIs"],
    });
    expect(fromUploaded.workExperiences[0].value).toMatchObject({
      companyName: "JOBHUB",
      startDate: null,
      period: "2020 to present",
      description: "Built APIs",
      achievements: ["Built APIs"],
    });
    for (const view of views) {
      for (const group of Object.values(view)) {
        expect(Array.isArray(group)).toBe(true);
        for (const entry of group) {
          expect(Object.keys(entry)).toEqual(["value", "provenance"]);
          expect(Object.keys(entry.provenance)).toEqual([
            "sourcePath", "fieldSourcePaths", "evidence",
          ]);
        }
      }
    }
  });

  it("preserves source-specific evidence, conflicting claims and unresolved content", () => {
    const generated = normalizeGeneratedCv(generatedSource);
    const uploaded = composeUploadedCvProfile({
      cvSource: metadata,
      extractedText: pdfText,
      pdfExtractionOutput: JSON.stringify(pdfExtraction),
    });
    const fromGenerated = readCvCareerContent(generated.profile);
    const fromUploaded = readCvCareerContent(uploaded.profile);

    expect(fromGenerated.professionalSummary[0].provenance).toEqual({
      sourcePath: "/generatedContent/professionalSummary",
      fieldSourcePaths: {},
      evidence: [],
    });
    expect(fromGenerated.workExperiences[0].provenance).toEqual({
      sourcePath: "/generatedContent/workExperiences/0",
      fieldSourcePaths: {
        companyName: "/generatedContent/workExperiences/0/companyName",
        position: "/generatedContent/workExperiences/0/position",
        startDate: "/generatedContent/workExperiences/0/startDate",
        description: "/generatedContent/workExperiences/0/description",
        achievements: ["/generatedContent/workExperiences/0/achievements/0"],
      },
      evidence: [],
    });
    expect(fromUploaded.workExperiences[0].provenance).toEqual({
      sourcePath: null,
      fieldSourcePaths: {},
      evidence: ["JOBHUB Engineer 2020 to present. Built APIs"],
    });
    expect(fromUploaded.otherCareerClaims.map(({ value }) => value)).toEqual([
      "Three years Python", "Five years Python",
    ]);
    expect(fromUploaded.unresolvedContent[0]).toEqual({
      value: "Maybe cloud work",
      provenance: { sourcePath: null, fieldSourcePaths: {}, evidence: ["Maybe cloud work"] },
    });
    expect(generated.profile.freeText.professionalSummary.value).toBe("Backend developer");
    expect(Object.keys(generated.profile)).toEqual(["source", "freeText", "metadata", "content"]);
    expect(uploaded.profile.pdfContent).toEqual(pdfExtraction);
  });

  it("keeps all structured item groups readable without interpreting source-specific fields", () => {
    const generated = normalizeGeneratedCv({
      ...generatedSource,
      generatedContent: {
        ...generatedSource.generatedContent,
        projects: [{
          name: "Portal", role: "Lead", technologies: ["Node.js"],
          description: "Built portal", projectUrl: "https://example.com/portal",
        }],
        educations: [{
          institutionName: "University", degree: "BSc", fieldOfStudy: "CS",
          startDate: "2012-01-01T00:00:00.000Z", endDate: null,
        }],
        certifications: [{
          name: "Cloud certificate", issuer: "Vendor",
          issueDate: "2022-01-01T00:00:00.000Z", expirationDate: null,
          credentialId: "C-1", credentialUrl: null,
        }],
        languages: [{ name: "English", proficiency: "ADVANCED" }],
      },
    });
    const uploaded = composeUploadedCvProfile({
      cvSource: metadata,
      extractedText: [
        pdfText, "Portal Lead built portal with Node.js.", "University BSc CS.",
        "Cloud certificate Vendor C-1.", "English advanced.",
      ].join(" "),
      pdfExtractionOutput: JSON.stringify({
        ...pdfExtraction,
        projects: [{
          name: "Portal", role: "Lead", period: "2019", technologies: ["Node.js"],
          description: "Built portal", evidence: ["Portal Lead built portal with Node.js"],
        }],
        educations: [{
          institutionName: "University", degree: "BSc", fieldOfStudy: "CS",
          period: "2012 to 2016", evidence: ["University BSc CS"],
        }],
        certifications: [{
          name: "Cloud certificate", issuer: "Vendor", date: "2022",
          credentialId: "C-1", evidence: ["Cloud certificate Vendor C-1"],
        }],
        languages: [{
          name: "English", statedProficiency: "advanced",
          evidence: ["English advanced"],
        }],
      }),
    });

    expect(generated.status).toBe("READY");
    expect(uploaded.status).toBe("READY");
    const fromGenerated = readCvCareerContent(generated.profile);
    const fromUploaded = readCvCareerContent(uploaded.profile);

    for (const group of ["projects", "educations", "certifications", "languages"]) {
      expect(Object.keys(fromGenerated[group][0].value)).toEqual(
        Object.keys(fromUploaded[group][0].value),
      );
    }
    expect(fromGenerated.projects[0].value.projectUrl).toBe("https://example.com/portal");
    expect(fromUploaded.projects[0].value.projectUrl).toBeNull();
    expect(fromUploaded.projects[0].value.period).toBe("2019");
    expect(fromGenerated.educations[0].value.startDate).toBe("2012-01-01T00:00:00.000Z");
    expect(fromGenerated.educations[0].value.period).toBeNull();
    expect(fromUploaded.educations[0].value.startDate).toBeNull();
    expect(fromUploaded.educations[0].value.period).toBe("2012 to 2016");
    expect(fromGenerated.certifications[0].value.issueDate).toBe("2022-01-01T00:00:00.000Z");
    expect(fromUploaded.certifications[0].value.issueDate).toBeNull();
    expect(fromUploaded.certifications[0].value.date).toBe("2022");
    expect(fromGenerated.languages[0].value.proficiency).toBe("ADVANCED");
    expect(fromGenerated.languages[0].value.statedProficiency).toBeNull();
    expect(fromUploaded.languages[0].value.proficiency).toBeNull();
    expect(fromUploaded.languages[0].value.statedProficiency).toBe("advanced");
    expect(fromGenerated.projects[0].provenance.fieldSourcePaths.technologies).toEqual([
      "/generatedContent/projects/0/technologies/0",
    ]);
    expect(fromUploaded.projects[0].provenance.evidence).toEqual([
      "Portal Lead built portal with Node.js",
    ]);
  });
});
