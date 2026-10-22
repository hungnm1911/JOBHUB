import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  CV_NORMALIZATION_ERROR_CODES,
  CV_NORMALIZATION_STATUS,
  CvNormalizationError,
  normalizeGeneratedCv,
} from "../src/normalization/cv-normalization.js";

const SUMMARY =
  "  Backend developer 5 năm kinh nghiệm Node.js, sẵn sàng làm việc từ xa.  ";
const WORK_DESCRIPTION = "Xây dựng API bằng Node.js và Docker.";
const GITHUB_LINK = "https://github.com/nguyenvana";
const PORTFOLIO_LINK = "nguyenvana.dev/portfolio";

const makeGeneratedContent = (overrides = {}) => ({
  personalInfo: { links: [GITHUB_LINK, PORTFOLIO_LINK] },
  professionalSummary: SUMMARY,
  educations: [
    {
      institutionName: "Đại học Bách khoa Hà Nội",
      degree: "Kỹ sư",
      fieldOfStudy: "Khoa học máy tính",
      startDate: "2012-09-01T00:00:00.000Z",
      endDate: "2017-06-30T00:00:00.000Z",
    },
  ],
  skills: ["Node.js", "Giao tiếp", "Node.js"],
  workExperiences: [
    {
      companyName: "JOBHUB",
      position: "Senior Backend Engineer",
      startDate: "2020-01-01T00:00:00.000Z",
      endDate: null,
      description: WORK_DESCRIPTION,
      achievements: ["Giảm 40% thời gian phản hồi API", "Dẫn dắt nhóm 3 người"],
    },
  ],
  projects: [
    {
      name: "Job Matching",
      role: "Tech lead",
      technologies: ["Node.js", "MongoDB"],
      description: "Hệ thống gợi ý việc làm.",
      projectUrl: "https://example.com/project",
    },
  ],
  certifications: [
    {
      name: "AWS Certified Developer",
      issuer: "Amazon",
      issueDate: "2022-03-15T00:00:00.000Z",
      expirationDate: null,
      credentialId: "AWS-123",
      credentialUrl: null,
    },
  ],
  languages: [{ name: "Tiếng Anh", proficiency: "ADVANCED" }],
  hiddenSections: [],
  ...overrides,
});

const makeCvSource = (overrides = {}) => ({
  candidateCvId: "cv-1",
  categoryId: "position-1",
  experienceLevelId: "level-1",
  skillTags: ["nodejs", "mongodb"],
  employmentTypes: ["FULL_TIME", "CONTRACT"],
  workModes: ["HYBRID"],
  preferredLocations: [
    { provinceCode: "01", districtCode: null },
    { provinceCode: "79", districtCode: "760" },
  ],
  generatedContent: makeGeneratedContent(),
  taxonomy: {
    category: {
      id: "position-1",
      name: "Backend Developer",
      level: "POSITION",
      parentCategoryId: "field-1",
    },
    experienceLevel: { id: "level-1", code: "THREE_TO_FIVE_YEARS" },
  },
  ...overrides,
});

const makeSparseCvSource = () =>
  makeCvSource({
    categoryId: "field-1",
    experienceLevelId: null,
    skillTags: [],
    employmentTypes: [],
    workModes: [],
    preferredLocations: [],
    generatedContent: makeGeneratedContent({
      personalInfo: { links: [] },
      professionalSummary: null,
      educations: [],
      skills: [],
      workExperiences: [],
      projects: [],
      certifications: [],
      languages: [],
      hiddenSections: [],
    }),
    taxonomy: {
      category: {
        id: "field-1",
        name: "Công nghệ thông tin",
        level: "FIELD",
        parentCategoryId: null,
      },
      experienceLevel: null,
    },
  });

const withContent = (contentOverrides) => {
  return makeCvSource({
    generatedContent: makeGeneratedContent(contentOverrides),
  });
};

const expectReady = (cvSource) => {
  const result = normalizeGeneratedCv(cvSource);

  expect(result.status).toBe(CV_NORMALIZATION_STATUS.READY);

  return result.profile;
};

const expectInvalidInput = (cvSource, expectedDetail) => {
  let caught;

  try {
    normalizeGeneratedCv(cvSource);
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(CvNormalizationError);
  expect(caught.code).toBe(
    CV_NORMALIZATION_ERROR_CODES.INVALID_GENERATED_CV_INPUT,
  );

  if (expectedDetail) {
    expect(caught.details).toContain(expectedDetail);
  }

  return caught;
};

describe("normalizeGeneratedCv — READY profile", () => {
  it("preserves complete metadata, content, free text, and provenance", () => {
    expect(normalizeGeneratedCv(makeCvSource())).toEqual({
      status: CV_NORMALIZATION_STATUS.READY,
      profile: {
        source: { type: "GENERATED_CV", candidateCvId: "cv-1" },
        freeText: {
          professionalSummary: {
            value: SUMMARY,
            sourcePath: "/generatedContent/professionalSummary",
          },
        },
        metadata: {
          categoryId: { value: "position-1", sourcePath: "/categoryId" },
          category: {
            value: {
              id: "position-1",
              name: "Backend Developer",
              level: "POSITION",
              parentCategoryId: "field-1",
            },
            sourcePath: "/taxonomy/category",
          },
          experienceLevelId: {
            value: "level-1",
            sourcePath: "/experienceLevelId",
          },
          experienceLevel: {
            value: { id: "level-1", code: "THREE_TO_FIVE_YEARS" },
            sourcePath: "/taxonomy/experienceLevel",
          },
          skillTags: [
            { value: "nodejs", sourcePath: "/skillTags/0" },
            { value: "mongodb", sourcePath: "/skillTags/1" },
          ],
          employmentTypes: [
            { value: "FULL_TIME", sourcePath: "/employmentTypes/0" },
            { value: "CONTRACT", sourcePath: "/employmentTypes/1" },
          ],
          workModes: [{ value: "HYBRID", sourcePath: "/workModes/0" }],
          preferredLocations: [
            {
              value: { provinceCode: "01", districtCode: null },
              sourcePath: "/preferredLocations/0",
            },
            {
              value: { provinceCode: "79", districtCode: "760" },
              sourcePath: "/preferredLocations/1",
            },
          ],
        },
        content: {
          skills: [
            { value: "Node.js", sourcePath: "/generatedContent/skills/0" },
            { value: "Giao tiếp", sourcePath: "/generatedContent/skills/1" },
            { value: "Node.js", sourcePath: "/generatedContent/skills/2" },
          ],
          educations: [
            {
              sourcePath: "/generatedContent/educations/0",
              institutionName: {
                value: "Đại học Bách khoa Hà Nội",
                sourcePath: "/generatedContent/educations/0/institutionName",
              },
              degree: {
                value: "Kỹ sư",
                sourcePath: "/generatedContent/educations/0/degree",
              },
              fieldOfStudy: {
                value: "Khoa học máy tính",
                sourcePath: "/generatedContent/educations/0/fieldOfStudy",
              },
              startDate: {
                value: "2012-09-01T00:00:00.000Z",
                sourcePath: "/generatedContent/educations/0/startDate",
              },
              endDate: {
                value: "2017-06-30T00:00:00.000Z",
                sourcePath: "/generatedContent/educations/0/endDate",
              },
            },
          ],
          workExperiences: [
            {
              sourcePath: "/generatedContent/workExperiences/0",
              companyName: {
                value: "JOBHUB",
                sourcePath: "/generatedContent/workExperiences/0/companyName",
              },
              position: {
                value: "Senior Backend Engineer",
                sourcePath: "/generatedContent/workExperiences/0/position",
              },
              startDate: {
                value: "2020-01-01T00:00:00.000Z",
                sourcePath: "/generatedContent/workExperiences/0/startDate",
              },
              endDate: null,
              freeText: {
                description: {
                  value: WORK_DESCRIPTION,
                  sourcePath: "/generatedContent/workExperiences/0/description",
                },
                achievements: [
                  {
                    value: "Giảm 40% thời gian phản hồi API",
                    sourcePath:
                      "/generatedContent/workExperiences/0/achievements/0",
                  },
                  {
                    value: "Dẫn dắt nhóm 3 người",
                    sourcePath:
                      "/generatedContent/workExperiences/0/achievements/1",
                  },
                ],
              },
            },
          ],
          projects: [
            {
              sourcePath: "/generatedContent/projects/0",
              name: {
                value: "Job Matching",
                sourcePath: "/generatedContent/projects/0/name",
              },
              role: {
                value: "Tech lead",
                sourcePath: "/generatedContent/projects/0/role",
              },
              technologies: [
                {
                  value: "Node.js",
                  sourcePath: "/generatedContent/projects/0/technologies/0",
                },
                {
                  value: "MongoDB",
                  sourcePath: "/generatedContent/projects/0/technologies/1",
                },
              ],
              projectUrl: {
                value: "https://example.com/project",
                sourcePath: "/generatedContent/projects/0/projectUrl",
              },
              freeText: {
                description: {
                  value: "Hệ thống gợi ý việc làm.",
                  sourcePath: "/generatedContent/projects/0/description",
                },
              },
            },
          ],
          certifications: [
            {
              sourcePath: "/generatedContent/certifications/0",
              name: {
                value: "AWS Certified Developer",
                sourcePath: "/generatedContent/certifications/0/name",
              },
              issuer: {
                value: "Amazon",
                sourcePath: "/generatedContent/certifications/0/issuer",
              },
              issueDate: {
                value: "2022-03-15T00:00:00.000Z",
                sourcePath: "/generatedContent/certifications/0/issueDate",
              },
              expirationDate: null,
              credentialId: {
                value: "AWS-123",
                sourcePath: "/generatedContent/certifications/0/credentialId",
              },
              credentialUrl: null,
            },
          ],
          languages: [
            {
              sourcePath: "/generatedContent/languages/0",
              name: {
                value: "Tiếng Anh",
                sourcePath: "/generatedContent/languages/0/name",
              },
              proficiency: {
                value: "ADVANCED",
                sourcePath: "/generatedContent/languages/0/proficiency",
              },
            },
          ],
          hiddenSections: [],
          links: [
            {
              value: GITHUB_LINK,
              sourcePath: "/generatedContent/personalInfo/links/0",
            },
            {
              value: PORTFOLIO_LINK,
              sourcePath: "/generatedContent/personalInfo/links/1",
            },
          ],
        },
      },
    });
  });

  it("returns READY for a CV with almost no career data, leaving fields empty", () => {
    expect(expectReady(makeSparseCvSource())).toEqual({
      source: { type: "GENERATED_CV", candidateCvId: "cv-1" },
      freeText: { professionalSummary: null },
      metadata: {
        categoryId: { value: "field-1", sourcePath: "/categoryId" },
        category: {
          value: {
            id: "field-1",
            name: "Công nghệ thông tin",
            level: "FIELD",
            parentCategoryId: null,
          },
          sourcePath: "/taxonomy/category",
        },
        experienceLevelId: null,
        experienceLevel: null,
        skillTags: [],
        employmentTypes: [],
        workModes: [],
        preferredLocations: [],
      },
      content: {
        skills: [],
        educations: [],
        workExperiences: [],
        projects: [],
        certifications: [],
        languages: [],
        hiddenSections: [],
        links: [],
      },
    });
  });

  it("preserves professional links verbatim, in order, with duplicates and CV provenance", () => {
    const links = [PORTFOLIO_LINK, "  github.com/nguyenvana  ", PORTFOLIO_LINK];
    const cvSource = withContent({ personalInfo: { links } });
    const profile = expectReady(cvSource);

    expect(profile.content.links).toEqual([
      { value: PORTFOLIO_LINK, sourcePath: "/generatedContent/personalInfo/links/0" },
      {
        value: "  github.com/nguyenvana  ",
        sourcePath: "/generatedContent/personalInfo/links/1",
      },
      { value: PORTFOLIO_LINK, sourcePath: "/generatedContent/personalInfo/links/2" },
    ]);
    expect(profile.source.candidateCvId).toBe(cvSource.candidateCvId);
    expect(profile.content).not.toHaveProperty("personalInfo");
  });

  it("leaves missing skills, experience, and education empty", () => {
    const profile = expectReady(
      withContent({ skills: [], workExperiences: [], educations: [] }),
    );

    expect(profile.content.skills).toEqual([]);
    expect(profile.content.workExperiences).toEqual([]);
    expect(profile.content.educations).toEqual([]);
    expect(profile.content.projects).toHaveLength(1);
  });

  it("preserves partially entered draft items without filling their fields", () => {
    const profile = expectReady(
      withContent({
        workExperiences: [
          {
            companyName: null,
            position: null,
            startDate: null,
            endDate: null,
            description: null,
            achievements: [],
          },
        ],
      }),
    );

    expect(profile.content.workExperiences).toEqual([
      {
        sourcePath: "/generatedContent/workExperiences/0",
        companyName: null,
        position: null,
        startDate: null,
        endDate: null,
        freeText: { description: null, achievements: [] },
      },
    ]);
  });

  it("does not fill empty metadata from free text", () => {
    const profile = expectReady(
      makeCvSource({ workModes: [], employmentTypes: [], skillTags: [] }),
    );

    expect(profile.freeText.professionalSummary.value).toBe(SUMMARY);
    expect(profile.metadata.workModes).toEqual([]);
    expect(profile.metadata.employmentTypes).toEqual([]);
    expect(profile.metadata.skillTags).toEqual([]);
  });

  it("keeps skillTags, content skills, and project technologies separate with duplicates", () => {
    const profile = expectReady(
      makeCvSource({ skillTags: ["nodejs", "Kỹ năng chưa có taxonomy", "nodejs"] }),
    );

    expect(profile.metadata.skillTags.map(({ value }) => value)).toEqual([
      "nodejs",
      "Kỹ năng chưa có taxonomy",
      "nodejs",
    ]);
    expect(profile.content.skills.map(({ value }) => value)).toEqual([
      "Node.js",
      "Giao tiếp",
      "Node.js",
    ]);
    expect(
      profile.content.projects[0].technologies.map(({ value }) => value),
    ).toEqual(["Node.js", "MongoDB"]);
  });

  it("preserves conflicting experience claims without deriving durations", () => {
    const overlapping = {
      companyName: "Công ty B",
      position: "Junior Developer",
      startDate: "2021-06-01T00:00:00.000Z",
      endDate: "2019-01-01T00:00:00.000Z",
      description: "Hơn 10 năm kinh nghiệm Java.",
      achievements: [],
    };
    const cvSource = makeCvSource({
      experienceLevelId: "level-0",
      taxonomy: {
        ...makeCvSource().taxonomy,
        experienceLevel: { id: "level-0", code: "UNDER_1_YEAR" },
      },
      generatedContent: makeGeneratedContent({
        workExperiences: [
          makeGeneratedContent().workExperiences[0],
          overlapping,
        ],
      }),
    });
    const profile = expectReady(cvSource);

    expect(profile.metadata.experienceLevel.value.code).toBe("UNDER_1_YEAR");
    expect(profile.freeText.professionalSummary.value).toContain("5 năm");
    expect(profile.content.workExperiences[1]).toMatchObject({
      startDate: { value: "2021-06-01T00:00:00.000Z" },
      endDate: { value: "2019-01-01T00:00:00.000Z" },
      freeText: { description: { value: "Hơn 10 năm kinh nghiệm Java." } },
    });

    const serialized = JSON.stringify(profile);

    for (const derived of ["duration", "years", "seniority", "verified"]) {
      expect(serialized).not.toContain(`"${derived}`);
    }
  });

  it("keeps unmappable language proficiency verbatim and does not fill it", () => {
    const profile = expectReady(
      withContent({
        languages: [{ name: "Tiếng Anh (IELTS 7.0 / B2)", proficiency: null }],
      }),
    );

    expect(profile.content.languages).toEqual([
      {
        sourcePath: "/generatedContent/languages/0",
        name: {
          value: "Tiếng Anh (IELTS 7.0 / B2)",
          sourcePath: "/generatedContent/languages/0/name",
        },
        proficiency: null,
      },
    ]);
  });

  it("preserves hiddenSections and the content of hidden sections", () => {
    const profile = expectReady(
      withContent({ hiddenSections: ["projects", "skills"] }),
    );

    expect(profile.content.hiddenSections).toEqual([
      { value: "projects", sourcePath: "/generatedContent/hiddenSections/0" },
      { value: "skills", sourcePath: "/generatedContent/hiddenSections/1" },
    ]);
    expect(profile.content.projects).toHaveLength(1);
    expect(profile.content.skills).toHaveLength(3);
  });

  it("does not deduplicate content shared by structured data and free text", () => {
    const profile = expectReady(makeCvSource());

    expect(profile.content.skills[0].value).toBe("Node.js");
    expect(
      profile.content.workExperiences[0].freeText.description.value,
    ).toContain("Node.js");
    expect(profile.content.projects[0].technologies[0].value).toBe("Node.js");
  });

  it("is deterministic, deeply frozen, and does not mutate its input", () => {
    const cvSource = makeCvSource();
    const snapshot = structuredClone(cvSource);
    const first = normalizeGeneratedCv(cvSource);
    const second = normalizeGeneratedCv(structuredClone(cvSource));

    expect(first).toEqual(second);
    expect(cvSource).toEqual(snapshot);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.profile.content.workExperiences[0].freeText)).toBe(
      true,
    );
    expect(Object.isFrozen(first.profile.metadata.preferredLocations[0].value)).toBe(
      true,
    );
  });

  it("does not share mutable references with the source", () => {
    const cvSource = makeCvSource();
    const profile = expectReady(cvSource);

    expect(Object.isFrozen(cvSource.preferredLocations[0])).toBe(false);
    expect(Object.isFrozen(cvSource.taxonomy.category)).toBe(false);
    expect(profile.metadata.category.value).not.toBe(cvSource.taxonomy.category);
  });
});

describe("normalizeGeneratedCv — input refusal", () => {
  it.each([
    ["a non-object source", null, "Generated CV source must be a plain object"],
    [
      "an unknown top-level field",
      { ...makeCvSource(), name: "CV của tôi" },
      "/name is not an allowed field",
    ],
    [
      "a missing top-level field",
      (() => {
        const source = makeCvSource();
        delete source.skillTags;
        return source;
      })(),
      "/skillTags is required",
    ],
    [
      "personal contact data beside links",
      withContent({ personalInfo: { links: [], fullName: "Nguyễn Văn A" } }),
      "/generatedContent/personalInfo/fullName is not an allowed field",
    ],
    [
      "a missing personalInfo links projection",
      withContent({ personalInfo: undefined }),
      "/generatedContent/personalInfo must be an object containing only links",
    ],
    [
      "a missing links field",
      withContent({ personalInfo: {} }),
      "/generatedContent/personalInfo/links is required",
    ],
    [
      "an empty link",
      withContent({ personalInfo: { links: [GITHUB_LINK, ""] } }),
      "/generatedContent/personalInfo/links/1 must be a non-empty string",
    ],
    [
      "an empty candidateCvId",
      makeCvSource({ candidateCvId: " " }),
      "/candidateCvId must be a non-empty string",
    ],
    [
      "a missing categoryId",
      makeCvSource({ categoryId: null }),
      "/categoryId must be a non-empty string",
    ],
    [
      "an empty skill tag",
      makeCvSource({ skillTags: [""] }),
      "/skillTags/0 must be a non-empty string",
    ],
    [
      "a non-canonical employment type",
      makeCvSource({ employmentTypes: ["FULLTIME"] }),
      "/employmentTypes/0 must be a canonical EmploymentType value",
    ],
    [
      "duplicate work modes",
      makeCvSource({ workModes: ["REMOTE", "REMOTE"] }),
      "/workModes must not contain duplicates",
    ],
    [
      "a preferred location without province",
      makeCvSource({ preferredLocations: [{ provinceCode: "", districtCode: null }] }),
      "/preferredLocations/0/provinceCode must be a non-empty string",
    ],
    [
      "an empty professional summary",
      withContent({ professionalSummary: "  " }),
      "/generatedContent/professionalSummary must be null or a non-empty string",
    ],
    [
      "a Date object instead of an ISO string",
      withContent({
        educations: [
          {
            ...makeGeneratedContent().educations[0],
            startDate: new Date("2012-09-01T00:00:00.000Z"),
          },
        ],
      }),
      "/generatedContent/educations/0/startDate must be null or an ISO 8601 date string",
    ],
    [
      "a non-normalized date string",
      withContent({
        certifications: [
          { ...makeGeneratedContent().certifications[0], issueDate: "2022-03-15" },
        ],
      }),
      "/generatedContent/certifications/0/issueDate must be null or an ISO 8601 date string",
    ],
    [
      "a missing item field",
      withContent({ languages: [{ name: "Tiếng Anh" }] }),
      "/generatedContent/languages/0/proficiency is required",
    ],
    [
      "a non-canonical language proficiency",
      withContent({ languages: [{ name: "Tiếng Anh", proficiency: "B2" }] }),
      "/generatedContent/languages/0/proficiency must be null or a canonical language proficiency value",
    ],
    [
      "an empty achievement",
      withContent({
        workExperiences: [
          { ...makeGeneratedContent().workExperiences[0], achievements: [""] },
        ],
      }),
      "/generatedContent/workExperiences/0/achievements/0 must be a non-empty string",
    ],
    [
      "a non-canonical hidden section",
      withContent({ hiddenSections: ["personalInfo"] }),
      "/generatedContent/hiddenSections/0 must be a canonical Harvard section value",
    ],
  ])("refuses %s", (_label, cvSource, expectedDetail) => {
    expectInvalidInput(cvSource, expectedDetail);
  });

  it("refuses taxonomy that does not resolve the CV's IDs", () => {
    const source = makeCvSource();

    expectInvalidInput(
      makeCvSource({ categoryId: "position-9" }),
      "/taxonomy/category must resolve /categoryId",
    );
    expectInvalidInput(
      makeCvSource({ experienceLevelId: null }),
      "/taxonomy/experienceLevel must be null when /experienceLevelId is null",
    );
    expectInvalidInput(
      makeCvSource({ taxonomy: { ...source.taxonomy, experienceLevel: null } }),
      "/taxonomy/experienceLevel must resolve /experienceLevelId",
    );
    expectInvalidInput(
      makeCvSource({
        taxonomy: {
          ...source.taxonomy,
          category: { ...source.taxonomy.category, parentCategoryId: null },
        },
      }),
      "/taxonomy/category POSITION Category must have a parent",
    );
    expectInvalidInput(
      makeCvSource({ taxonomy: { category: source.taxonomy.category } }),
      "/taxonomy/experienceLevel is required",
    );
  });

  it("does not echo CV content in refusal details", () => {
    const error = expectInvalidInput(
      makeCvSource({ workModes: ["Làm việc từ xa"] }),
    );

    expect(error.message).not.toContain("Làm việc từ xa");
    expect(error.details.join(" ")).not.toContain("Làm việc từ xa");
  });
});

describe("normalizeGeneratedCv — FAILED result", () => {
  const withSummaryReads = (readSummary) => {
    const generatedContent = makeGeneratedContent();
    let reads = 0;

    Object.defineProperty(generatedContent, "professionalSummary", {
      enumerable: true,
      get() {
        reads += 1;
        return readSummary(reads);
      },
    });

    return makeCvSource({ generatedContent });
  };

  it("returns FAILED without a profile when normalization cannot complete", () => {
    const cvSource = withSummaryReads((reads) => {
      if (reads > 1) {
        throw new Error("source unavailable");
      }

      return SUMMARY;
    });

    expect(normalizeGeneratedCv(cvSource)).toEqual({
      status: CV_NORMALIZATION_STATUS.FAILED,
      profile: null,
    });
  });

  it("returns FAILED rather than READY when the profile no longer matches its source", () => {
    const cvSource = withSummaryReads((reads) => `Tóm tắt phiên bản ${reads}`);

    expect(normalizeGeneratedCv(cvSource)).toEqual({
      status: CV_NORMALIZATION_STATUS.FAILED,
      profile: null,
    });
  });

  it("returns FAILED rather than READY when source links are not all preserved", () => {
    const cvSource = makeCvSource();
    let reads = 0;

    Object.defineProperty(cvSource.generatedContent.personalInfo, "links", {
      enumerable: true,
      get() {
        reads += 1;
        return reads > 2 ? [GITHUB_LINK] : [GITHUB_LINK, PORTFOLIO_LINK];
      },
    });

    expect(normalizeGeneratedCv(cvSource)).toEqual({
      status: CV_NORMALIZATION_STATUS.FAILED,
      profile: null,
    });
  });
});

describe("Generated CV normalization module boundary", () => {
  const importsOf = async (path) => {
    const source = await readFile(new URL(path, import.meta.url), "utf8");

    return [...source.matchAll(/from\s+"([^"]+)"/g)].map(
      ([, specifier]) => specifier,
    );
  };

  it("imports no LLM provider, fallback, contract loader, or contract JSON", async () => {
    expect(
      await importsOf("../src/normalization/cv-normalization.js"),
    ).toEqual(["node:util", "./normalization-support.js"]);
    expect(
      await importsOf("../src/normalization/normalization-support.js"),
    ).toEqual([]);
  });

  it("is reachable only through the createAiKit instance, not as a package-root export", async () => {
    const packageRoot = await import("../src/index.js");

    expect(Object.keys(packageRoot)).not.toContain("normalizeGeneratedCv");
  });
});
