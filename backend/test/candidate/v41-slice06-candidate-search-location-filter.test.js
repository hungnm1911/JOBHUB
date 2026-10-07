import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_STATUS from "../../src/constants/user-status.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";
import {
  DEFAULT_PASSWORD,
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";
import {
  jsonResponse,
  stubLocationProvider,
  TEST_LOCATION,
} from "../helpers/location-provider.js";

const SEARCH_PATH = "/api/jobs/candidate-search/cvs";

// Province Open API v1 code of Quận Hoàn Kiếm (Hà Nội). Only seeded as a
// persisted preference, never used as a filter District, so it is not part of
// the stub dataset.
const HA_NOI_HOAN_KIEM = "2";

const selection = (provinceCode, districtCode = null) => ({
  provinceCode,
  districtCode,
});

const HA_NOI_ALL = selection(TEST_LOCATION.HA_NOI);
const HA_NOI_BA_DINH = selection(
  TEST_LOCATION.HA_NOI,
  TEST_LOCATION.HA_NOI_BA_DINH,
);
const HA_NOI_BA_VI = selection(TEST_LOCATION.HA_NOI, TEST_LOCATION.HA_NOI_BA_VI);
const HA_NOI_HOAN_KIEM_ONLY = selection(TEST_LOCATION.HA_NOI, HA_NOI_HOAN_KIEM);
const HO_CHI_MINH_ALL = selection(TEST_LOCATION.HO_CHI_MINH);
const HO_CHI_MINH_DISTRICT_1 = selection(
  TEST_LOCATION.HO_CHI_MINH,
  TEST_LOCATION.HO_CHI_MINH_DISTRICT_1,
);
const HA_GIANG_CITY = selection(
  TEST_LOCATION.HA_GIANG,
  TEST_LOCATION.HA_GIANG_CITY,
);

describe("V4.1 Slice 06 — Candidate Search Location hierarchy filter (F05)", () => {
  let providerFetch;
  let sequence = 0;

  beforeAll(async () => {
    await connectTestDatabase();
  });

  beforeEach(() => {
    providerFetch = stubLocationProvider();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  const createContext = async () => {
    sequence += 1;

    const manager = await createActiveCompanyManagerContext({
      email: `v41s06.manager.${sequence}@example.com`,
      businessRegistrationNumber: `BRN-V41-S06-${sequence}`,
    });
    const recruiter = await createActiveRecruiterContext({
      email: `v41s06.recruiter.${sequence}@example.com`,
      company: manager.company,
      employeeCode: `V41S06-R${sequence}`,
    });

    await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: recruiter.membership._id,
      primaryRecruiterCompanyMemberId: recruiter.membership._id,
      supportingRecruiterCompanyMemberIds: [],
      status: JOB_STATUS.DRAFT,
    });

    const candidate = await createVerifiedUser({
      email: `v41s06.candidate.${sequence}@example.com`,
      fullName: `Slice06 Candidate ${sequence}`,
    });
    const category = await Category.create({
      name: `V41 S06 Field ${sequence}`,
      level: CATEGORY_LEVEL.FIELD,
    });
    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    let cvSequence = 0;

    const createCv = async ({
      name,
      preferredLocations = [],
      candidateUserId = candidate.user._id,
      categoryId = category._id,
      sourceType = CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      status = CANDIDATE_CV_STATUS.ACTIVE,
      visibility = CANDIDATE_CV_VISIBILITY.PUBLIC,
      archivedAt = null,
      experienceLevelId = null,
      skillTags = [],
      employmentTypes = [],
      workModes = [],
      updatedAt,
    }) => {
      cvSequence += 1;

      const doc = {
        candidateUserId,
        categoryId,
        name,
        sourceType,
        status,
        visibility,
        archivedAt,
        experienceLevelId,
        preferredLocations,
        skillTags,
        employmentTypes,
        workModes,
        isDefault: false,
      };

      if (sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
        doc.generatedContent = {};
      } else {
        doc.uploadedFile = {
          storageKey: `candidate-cvs/${new mongoose.Types.ObjectId().toString()}`,
          originalFileName: "uploaded.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          pageCount: 1,
          uploadedAt: new Date("2026-08-01T00:00:00.000Z"),
        };
      }

      const created = await CandidateCV.create(doc);

      await CandidateCV.updateOne(
        { _id: created._id },
        {
          $set: {
            updatedAt:
              updatedAt ??
              new Date(Date.UTC(2026, 7, 1, 0, cvSequence)),
          },
        },
        { timestamps: false },
      );

      return created;
    };

    return { agent, accessToken, recruiter, candidate, category, createCv };
  };

  const search = (context, query = {}) => {
    return context.agent
      .get(SEARCH_PATH)
      .query(query)
      .set("Authorization", `Bearer ${context.accessToken}`);
  };

  const searchIds = async (context, query) => {
    const response = await search(context, query);

    expect(response.status).toBe(200);

    return response.body.cvs.map((cv) => cv.cvId).sort();
  };

  const idsOf = (...cvs) => cvs.map((cv) => cv._id.toString()).sort();

  describe("canonical Candidate Search truth table", () => {
    it.each([
      ["Hà Nội / ALL", [HA_NOI_ALL], TEST_LOCATION.HA_NOI, true],
      ["Hà Nội / Ba Đình", [HA_NOI_BA_DINH], TEST_LOCATION.HA_NOI, true],
      [
        "Hà Nội / ALL",
        [HA_NOI_ALL],
        `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
        true,
      ],
      [
        "Hà Nội / Ba Đình",
        [HA_NOI_BA_DINH],
        `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
        true,
      ],
      [
        "Hà Nội / Hoàn Kiếm",
        [HA_NOI_HOAN_KIEM_ONLY],
        `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
        false,
      ],
      ["Hồ Chí Minh / ALL", [HO_CHI_MINH_ALL], TEST_LOCATION.HA_NOI, false],
      [
        "Hồ Chí Minh / ALL",
        [HO_CHI_MINH_ALL],
        `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
        false,
      ],
      [
        "Hồ Chí Minh / Quận 1",
        [HO_CHI_MINH_DISTRICT_1],
        TEST_LOCATION.HA_NOI,
        false,
      ],
      [
        "Hồ Chí Minh / ALL",
        [HO_CHI_MINH_ALL],
        `${TEST_LOCATION.HO_CHI_MINH}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
        false,
      ],
      [
        "Hồ Chí Minh / ALL",
        [HO_CHI_MINH_ALL],
        `${TEST_LOCATION.HO_CHI_MINH}:${TEST_LOCATION.UNKNOWN_DISTRICT}`,
        false,
      ],
    ])(
      "Candidate %s vs filter %s → match %s",
      async (_, preferredLocations, filter, expected) => {
        const context = await createContext();
        const cv = await context.createCv({ name: "CV", preferredLocations });

        expect(
          await searchIds(context, { preferredLocations: filter }),
        ).toEqual(expected ? idsOf(cv) : []);
      },
    );

    const seedTruthTableCvs = async (createCv) => ({
      haNoiAll: await createCv({ name: "HN ALL", preferredLocations: [HA_NOI_ALL] }),
      haNoiBaDinh: await createCv({
        name: "HN Ba Dinh",
        preferredLocations: [HA_NOI_BA_DINH],
      }),
      haNoiHoanKiem: await createCv({
        name: "HN Hoan Kiem",
        preferredLocations: [HA_NOI_HOAN_KIEM_ONLY],
      }),
      hoChiMinhAll: await createCv({
        name: "HCM ALL",
        preferredLocations: [HO_CHI_MINH_ALL],
      }),
      hoChiMinhDistrict1: await createCv({
        name: "HCM District 1",
        preferredLocations: [HO_CHI_MINH_DISTRICT_1],
      }),
    });

    it("Province / ALL filter matches Province-wide and District-subset Candidates of that Province only", async () => {
      const context = await createContext();
      const cvs = await seedTruthTableCvs(context.createCv);

      expect(
        await searchIds(context, { preferredLocations: TEST_LOCATION.HA_NOI }),
      ).toEqual(idsOf(cvs.haNoiAll, cvs.haNoiBaDinh, cvs.haNoiHoanKiem));
    });

    it("District filter matches Province-wide and exact District Candidates only", async () => {
      const context = await createContext();
      const cvs = await seedTruthTableCvs(context.createCv);

      expect(
        await searchIds(context, {
          preferredLocations: `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
        }),
      ).toEqual(idsOf(cvs.haNoiAll, cvs.haNoiBaDinh));
    });
  });

  describe("Candidates with multiple preferences", () => {
    it("matches when one District of a multi-District preference satisfies the filter", async () => {
      const context = await createContext();
      const cv = await context.createCv({
        name: "Ba Vi + Ba Dinh",
        preferredLocations: [HA_NOI_BA_VI, HA_NOI_BA_DINH],
      });

      expect(
        await searchIds(context, {
          preferredLocations: `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
        }),
      ).toEqual(idsOf(cv));
    });

    it("matches when one Province of a multi-Province preference satisfies the filter", async () => {
      const context = await createContext();
      const cv = await context.createCv({
        name: "HCM ALL + HN Ba Dinh + Ha Giang City",
        preferredLocations: [HO_CHI_MINH_ALL, HA_NOI_BA_DINH, HA_GIANG_CITY],
      });

      for (const filter of [
        TEST_LOCATION.HA_NOI,
        `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
        `${TEST_LOCATION.HO_CHI_MINH}:${TEST_LOCATION.HO_CHI_MINH_DISTRICT_1}`,
        TEST_LOCATION.HA_GIANG,
      ]) {
        expect(
          await searchIds(context, { preferredLocations: filter }),
        ).toEqual(idsOf(cv));
      }
    });

    it("requires Province and District to come from the same preference", async () => {
      const context = await createContext();

      await context.createCv({
        name: "HN Hoan Kiem + HCM ALL",
        preferredLocations: [HA_NOI_HOAN_KIEM_ONLY, HO_CHI_MINH_ALL],
      });
      await context.createCv({
        name: "HN Ba Vi + HCM District 1",
        preferredLocations: [HA_NOI_BA_VI, HO_CHI_MINH_DISTRICT_1],
      });

      expect(
        await searchIds(context, {
          preferredLocations: `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
        }),
      ).toEqual([]);
    });
  });

  describe("OR composition inside the Location group", () => {
    it("combines multiple Provinces with OR", async () => {
      const context = await createContext();
      const haNoi = await context.createCv({
        name: "HN Ba Vi",
        preferredLocations: [HA_NOI_BA_VI],
      });
      const hoChiMinh = await context.createCv({
        name: "HCM ALL",
        preferredLocations: [HO_CHI_MINH_ALL],
      });
      await context.createCv({
        name: "Ha Giang",
        preferredLocations: [HA_GIANG_CITY],
      });

      expect(
        await searchIds(context, {
          preferredLocations: `${TEST_LOCATION.HA_NOI};${TEST_LOCATION.HO_CHI_MINH}`,
        }),
      ).toEqual(idsOf(haNoi, hoChiMinh));
    });

    it("combines multiple Districts of one Province with OR across every supported encoding", async () => {
      const context = await createContext();
      const haNoiAll = await context.createCv({
        name: "HN ALL",
        preferredLocations: [HA_NOI_ALL],
      });
      const baDinh = await context.createCv({
        name: "HN Ba Dinh",
        preferredLocations: [HA_NOI_BA_DINH],
      });
      const baVi = await context.createCv({
        name: "HN Ba Vi",
        preferredLocations: [HA_NOI_BA_VI],
      });
      await context.createCv({
        name: "HN Hoan Kiem",
        preferredLocations: [HA_NOI_HOAN_KIEM_ONLY],
      });
      const expected = idsOf(haNoiAll, baDinh, baVi);

      expect(
        await searchIds(context, {
          preferredLocations: `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}|${TEST_LOCATION.HA_NOI_BA_VI}`,
        }),
      ).toEqual(expected);

      const repeated = await context.agent
        .get(
          `${SEARCH_PATH}?preferredLocations=${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}&preferredLocations=${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_VI}`,
        )
        .set("Authorization", `Bearer ${context.accessToken}`);

      expect(repeated.status).toBe(200);
      expect(repeated.body.cvs.map((cv) => cv.cvId).sort()).toEqual(expected);

      expect(
        await searchIds(context, {
          preferredLocations: JSON.stringify([
            {
              provinceCode: TEST_LOCATION.HA_NOI,
              districtCodes: [
                TEST_LOCATION.HA_NOI_BA_DINH,
                TEST_LOCATION.HA_NOI_BA_VI,
              ],
            },
          ]),
        }),
      ).toEqual(expected);
    });
  });

  it("does not restrict by Location when no Location filter is given (BR-15, BR-16)", async () => {
    const context = await createContext();
    const none = await context.createCv({ name: "No preference" });
    const haNoi = await context.createCv({
      name: "HN ALL",
      preferredLocations: [HA_NOI_ALL],
    });
    const hoChiMinh = await context.createCv({
      name: "HCM District 1",
      preferredLocations: [HO_CHI_MINH_DISTRICT_1],
    });
    const all = idsOf(none, haNoi, hoChiMinh);

    expect(await searchIds(context, {})).toEqual(all);
    expect(await searchIds(context, { preferredLocations: "" })).toEqual(all);
    expect(
      await searchIds(context, { preferredLocations: TEST_LOCATION.HA_NOI }),
    ).toEqual(idsOf(haNoi));
  });

  it("matches nothing for a well-formed unknown Province code", async () => {
    const context = await createContext();
    await context.createCv({ name: "HN ALL", preferredLocations: [HA_NOI_ALL] });
    await context.createCv({
      name: "HCM ALL",
      preferredLocations: [HO_CHI_MINH_ALL],
    });

    expect(
      await searchIds(context, {
        preferredLocations: TEST_LOCATION.UNKNOWN_PROVINCE,
      }),
    ).toEqual([]);
    expect(
      await searchIds(context, {
        preferredLocations: `${TEST_LOCATION.UNKNOWN_PROVINCE}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
      }),
    ).toEqual([]);
  });

  describe("Province / District membership of the filter", () => {
    const seedMembershipCvs = async (createCv) => ({
      none: await createCv({ name: "No preference" }),
      haNoiAll: await createCv({ name: "HN ALL", preferredLocations: [HA_NOI_ALL] }),
      haNoiBaDinh: await createCv({
        name: "HN Ba Dinh",
        preferredLocations: [HA_NOI_BA_DINH],
      }),
      haNoiBaVi: await createCv({
        name: "HN Ba Vi",
        preferredLocations: [HA_NOI_BA_VI],
      }),
      haNoiHoanKiem: await createCv({
        name: "HN Hoan Kiem",
        preferredLocations: [HA_NOI_HOAN_KIEM_ONLY],
      }),
      hoChiMinhAll: await createCv({
        name: "HCM ALL",
        preferredLocations: [HO_CHI_MINH_ALL],
      }),
      hoChiMinhDistrict1: await createCv({
        name: "HCM District 1",
        preferredLocations: [HO_CHI_MINH_DISTRICT_1],
      }),
      haGiangAll: await createCv({
        name: "HG ALL",
        preferredLocations: [selection(TEST_LOCATION.HA_GIANG)],
      }),
      haGiangCity: await createCv({
        name: "HG City",
        preferredLocations: [HA_GIANG_CITY],
      }),
    });

    it("a Province-wide Candidate does not match its Province paired with another Province's District", async () => {
      const context = await createContext();
      await seedMembershipCvs(context.createCv);

      expect(
        await searchIds(context, {
          preferredLocations: `${TEST_LOCATION.HO_CHI_MINH}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
        }),
      ).toEqual([]);
      expect(
        await searchIds(context, {
          preferredLocations: JSON.stringify([
            {
              provinceCode: TEST_LOCATION.HO_CHI_MINH,
              districtCodes: [TEST_LOCATION.HA_NOI_BA_DINH],
            },
          ]),
        }),
      ).toEqual([]);
    });

    it("a well-formed unknown District matches nothing with 200", async () => {
      const context = await createContext();
      await seedMembershipCvs(context.createCv);

      expect(
        await searchIds(context, {
          preferredLocations: `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.UNKNOWN_DISTRICT}`,
        }),
      ).toEqual([]);
    });

    it("an invalid District contributes nothing while valid Districts of the same Province still match", async () => {
      const context = await createContext();
      const cvs = await seedMembershipCvs(context.createCv);

      expect(
        await searchIds(context, {
          preferredLocations: `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}|${TEST_LOCATION.UNKNOWN_DISTRICT}|${TEST_LOCATION.HO_CHI_MINH_DISTRICT_1}`,
        }),
      ).toEqual(idsOf(cvs.haNoiAll, cvs.haNoiBaDinh));
    });

    it("mixes Province / ALL groups with District-subset groups across Provinces", async () => {
      const context = await createContext();
      const cvs = await seedMembershipCvs(context.createCv);
      const expected = idsOf(
        cvs.hoChiMinhAll,
        cvs.hoChiMinhDistrict1,
        cvs.haNoiAll,
        cvs.haNoiBaDinh,
        cvs.haNoiBaVi,
        cvs.haGiangAll,
        cvs.haGiangCity,
      );

      expect(
        await searchIds(context, {
          preferredLocations: `${TEST_LOCATION.HO_CHI_MINH};${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}|${TEST_LOCATION.HA_NOI_BA_VI};${TEST_LOCATION.HA_GIANG}`,
        }),
      ).toEqual(expected);

      const repeated = await context.agent
        .get(
          `${SEARCH_PATH}?preferredLocations=${TEST_LOCATION.HO_CHI_MINH}&preferredLocations=${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}&preferredLocations=${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_VI}&preferredLocations=${TEST_LOCATION.HA_GIANG}`,
        )
        .set("Authorization", `Bearer ${context.accessToken}`);

      expect(repeated.status).toBe(200);
      expect(repeated.body.cvs.map((cv) => cv.cvId).sort()).toEqual(expected);

      expect(
        await searchIds(context, {
          preferredLocations: JSON.stringify([
            { provinceCode: TEST_LOCATION.HO_CHI_MINH },
            {
              provinceCode: TEST_LOCATION.HA_NOI,
              districtCodes: [
                TEST_LOCATION.HA_NOI_BA_DINH,
                TEST_LOCATION.HA_NOI_BA_VI,
              ],
            },
            { provinceCode: TEST_LOCATION.HA_GIANG, districtCodes: [] },
          ]),
        }),
      ).toEqual(expected);
    });

    it("invalid groups contribute nothing to the OR while valid groups keep their results", async () => {
      const context = await createContext();
      const cvs = await seedMembershipCvs(context.createCv);

      expect(
        await searchIds(context, {
          preferredLocations: `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_VI};${TEST_LOCATION.HA_GIANG}:${TEST_LOCATION.HA_NOI_BA_DINH};${TEST_LOCATION.HO_CHI_MINH}:${TEST_LOCATION.UNKNOWN_DISTRICT};${TEST_LOCATION.UNKNOWN_PROVINCE}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
        }),
      ).toEqual(idsOf(cvs.haNoiAll, cvs.haNoiBaVi));
    });

    it("a filter whose every group is invalid matches nothing instead of lifting the Location restriction", async () => {
      const context = await createContext();
      await seedMembershipCvs(context.createCv);

      expect(
        await searchIds(context, {
          preferredLocations: `${TEST_LOCATION.HO_CHI_MINH}:${TEST_LOCATION.HA_NOI_BA_DINH};${TEST_LOCATION.HA_GIANG}:${TEST_LOCATION.UNKNOWN_DISTRICT}`,
        }),
      ).toEqual([]);
    });
  });

  it("ANDs the Location group with every other V14 filter group", async () => {
    const context = await createContext();
    const experience = await ExperienceLevel.create({
      code: "THREE_TO_FIVE_YEARS",
    });
    const otherExperience = await ExperienceLevel.create({
      code: "ONE_TO_THREE_YEARS",
    });
    const otherCategory = await Category.create({
      name: "V41 S06 Other Field",
      level: CATEGORY_LEVEL.FIELD,
    });
    const matching = {
      preferredLocations: [HA_NOI_BA_DINH],
      experienceLevelId: experience._id,
      skillTags: ["nodejs"],
      employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME],
      workModes: [WORK_MODE.HYBRID],
    };
    const target = await context.createCv({ name: "Target", ...matching });

    for (const [name, override] of [
      ["Wrong Location", { preferredLocations: [HO_CHI_MINH_ALL] }],
      ["Wrong District", { preferredLocations: [HA_NOI_BA_VI] }],
      ["Wrong Category", { categoryId: otherCategory._id }],
      ["Wrong Experience", { experienceLevelId: otherExperience._id }],
      ["Wrong Skill", { skillTags: ["reactjs"] }],
      ["Wrong Employment", { employmentTypes: [EMPLOYMENT_TYPE.PART_TIME] }],
      ["Wrong WorkMode", { workModes: [WORK_MODE.ONSITE] }],
    ]) {
      await context.createCv({ name, ...matching, ...override });
    }

    expect(
      await searchIds(context, {
        categoryIds: context.category._id.toString(),
        experienceLevelIds: experience._id.toString(),
        skillTags: "nodejs",
        preferredLocations: `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
        employmentTypes: EMPLOYMENT_TYPE.FULL_TIME,
        workModes: WORK_MODE.HYBRID,
      }),
    ).toEqual(idsOf(target));

    expect(
      await searchIds(context, {
        skillTags: "nodejs,reactjs",
        preferredLocations: TEST_LOCATION.HO_CHI_MINH,
      }),
    ).toHaveLength(1);
  });

  it("keeps V14 eligibility, visibility, and archive rules under a Location filter", async () => {
    const context = await createContext();
    const lockedOwner = await createVerifiedUser({
      email: "v41s06.locked@example.com",
      fullName: "Locked Owner",
      status: USER_STATUS.LOCKED,
    });
    const unverifiedOwner = await createVerifiedUser({
      email: "v41s06.unverified@example.com",
      fullName: "Unverified Owner",
    });

    await User.updateOne(
      { _id: unverifiedOwner.user._id },
      { $set: { emailVerifiedAt: null } },
    );

    const generated = await context.createCv({
      name: "Generated ACTIVE PUBLIC",
      preferredLocations: [HA_NOI_ALL],
    });
    const uploaded = await context.createCv({
      name: "Uploaded PUBLIC",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      preferredLocations: [HA_NOI_BA_DINH],
    });

    for (const overrides of [
      { name: "Generated DRAFT", status: CANDIDATE_CV_STATUS.DRAFT },
      { name: "PRIVATE", visibility: CANDIDATE_CV_VISIBILITY.PRIVATE },
      {
        name: "Archived",
        sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
        archivedAt: new Date("2026-08-10T00:00:00.000Z"),
      },
      { name: "Locked owner", candidateUserId: lockedOwner.user._id },
      { name: "Unverified owner", candidateUserId: unverifiedOwner.user._id },
    ]) {
      await context.createCv({ preferredLocations: [HA_NOI_ALL], ...overrides });
    }

    expect(
      await searchIds(context, { preferredLocations: TEST_LOCATION.HA_NOI }),
    ).toEqual(idsOf(generated, uploaded));
    expect(
      await searchIds(context, {
        preferredLocations: `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
      }),
    ).toEqual(idsOf(generated, uploaded));
  });

  it("keeps V14 Recruiter authorization under a Location filter", async () => {
    const context = await createContext();
    await context.createCv({ name: "HN ALL", preferredLocations: [HA_NOI_ALL] });

    const unauthenticated = await context.agent
      .get(SEARCH_PATH)
      .query({ preferredLocations: TEST_LOCATION.HA_NOI });
    expect(unauthenticated.status).toBe(401);

    const candidateAgent = createTestAgent();
    const candidateToken = await loginAndGetAccessToken(candidateAgent, {
      email: context.candidate.user.email,
      password: DEFAULT_PASSWORD,
    });
    const asCandidate = await candidateAgent
      .get(SEARCH_PATH)
      .query({ preferredLocations: TEST_LOCATION.HA_NOI })
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(asCandidate.status).toBe(403);

    await Job.deleteMany({});
    const withoutJobMembership = await search(context, {
      preferredLocations: TEST_LOCATION.HA_NOI,
    });
    expect(withoutJobMembership.status).toBe(403);
  });

  it("keeps the V14 updatedAt desc, _id desc order under a Location filter", async () => {
    const context = await createContext();
    const tie = new Date("2026-08-18T00:00:00.000Z");
    const oldest = await context.createCv({
      name: "Oldest",
      preferredLocations: [HA_NOI_BA_VI],
      updatedAt: new Date("2026-08-10T00:00:00.000Z"),
    });
    const tieFirst = await context.createCv({
      name: "Tie first",
      preferredLocations: [HA_NOI_ALL],
      updatedAt: tie,
    });
    const tieSecond = await context.createCv({
      name: "Tie second",
      preferredLocations: [HA_NOI_BA_DINH],
      updatedAt: tie,
    });
    await context.createCv({
      name: "Newest other Province",
      preferredLocations: [HO_CHI_MINH_ALL],
      updatedAt: new Date("2026-08-30T00:00:00.000Z"),
    });

    const response = await search(context, {
      preferredLocations: TEST_LOCATION.HA_NOI,
    });

    expect(response.status).toBe(200);
    expect(response.body.cvs.map((cv) => cv.cvId)).toEqual(
      [tieSecond, tieFirst, oldest].map((cv) => cv._id.toString()),
    );
  });

  it("serializes canonical structured preferredLocations on results without a CastError", async () => {
    const context = await createContext();
    const preferredLocations = [HA_NOI_BA_DINH, HA_NOI_BA_VI, HO_CHI_MINH_ALL];
    await context.createCv({ name: "Structured", preferredLocations });

    for (const query of [
      {},
      { preferredLocations: TEST_LOCATION.HA_NOI },
      {
        preferredLocations: `${TEST_LOCATION.HO_CHI_MINH}:${TEST_LOCATION.HO_CHI_MINH_DISTRICT_1}`,
      },
    ]) {
      const response = await search(context, query);

      expect(response.status).toBe(200);
      expect(response.body.cvs).toHaveLength(1);
      expect(response.body.cvs[0].preferredLocations).toEqual(
        preferredLocations,
      );
    }
  });

  it("calls the Location boundary only to resolve District membership of District filters", async () => {
    const context = await createContext();
    await context.createCv({
      name: "HN Ba Dinh",
      preferredLocations: [HA_NOI_BA_DINH],
    });

    await searchIds(context, {});
    await searchIds(context, {
      preferredLocations: `${TEST_LOCATION.HA_NOI};${TEST_LOCATION.HO_CHI_MINH}`,
    });
    await searchIds(context, {
      preferredLocations: TEST_LOCATION.UNKNOWN_PROVINCE,
    });
    await search(context, { preferredLocations: "HA_NOI" });

    expect(providerFetch).not.toHaveBeenCalled();

    await searchIds(context, {
      preferredLocations: `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH};${TEST_LOCATION.HO_CHI_MINH}`,
    });

    expect(providerFetch).toHaveBeenCalledTimes(1);
  });

  it("fails closed with 502 when the Location provider is unavailable for a District filter", async () => {
    providerFetch = stubLocationProvider({
      "/d/": () => jsonResponse({ detail: "unavailable" }, 503),
    });
    const context = await createContext();
    const haNoiAll = await context.createCv({
      name: "HN ALL",
      preferredLocations: [HA_NOI_ALL],
    });

    const districtFilter = await search(context, {
      preferredLocations: `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
    });

    expect(districtFilter.status).toBe(502);
    expect(districtFilter.body.error.details).toMatchObject({
      reason: "LOCATION_PROVIDER_UNAVAILABLE",
    });
    expect(
      await searchIds(context, { preferredLocations: TEST_LOCATION.HA_NOI }),
    ).toEqual(idsOf(haNoiAll));
  });

  it.each([
    ["legacy literal", "HA_NOI"],
    ["legacy comma list", "HA_NOI,DA_NANG"],
    ["comma-separated codes", `${TEST_LOCATION.HA_NOI},${TEST_LOCATION.HO_CHI_MINH}`],
    ["FOREIGN", "FOREIGN"],
    ["REMOTE", "REMOTE"],
    ["ALL as Province", "ALL"],
    ["ALL as District", `${TEST_LOCATION.HA_NOI}:ALL`],
    ["leading-zero code", "01"],
    ["decimal code", "1.0"],
    ["District without Province", `:${TEST_LOCATION.HA_NOI_BA_DINH}`],
    ["empty group", `${TEST_LOCATION.HA_NOI};`],
    ["extra hierarchy level", `${TEST_LOCATION.HA_NOI}:1:2`],
    [
      "same Province as ALL and District subset",
      `${TEST_LOCATION.HA_NOI};${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
    ],
    ["invalid JSON", "[{"],
    ["JSON numeric code", JSON.stringify([{ provinceCode: 1 }])],
    [
      "JSON singular districtCode",
      JSON.stringify([
        {
          provinceCode: TEST_LOCATION.HA_NOI,
          districtCode: TEST_LOCATION.HA_NOI_BA_DINH,
        },
      ]),
    ],
  ])(
    "rejects a structurally invalid or legacy Location filter (%s) with 400",
    async (_, value) => {
      const context = await createContext();
      await context.createCv({ name: "HN ALL", preferredLocations: [HA_NOI_ALL] });

      const response = await search(context, { preferredLocations: value });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toMatchObject({
        field: "preferredLocations",
      });
      expect(providerFetch).not.toHaveBeenCalled();
    },
  );
});
