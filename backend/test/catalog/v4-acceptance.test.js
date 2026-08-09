import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import mongoose from "mongoose";

import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import COMPANY_MEMBER_ROLE from "../../src/constants/company-member-role.js";
import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import LOCATION from "../../src/constants/location.js";
import USER_ROLE from "../../src/constants/user-role.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import { migrate as migrateExperienceLevels } from "../../src/database/migrations/v4-experience-level-dataset.js";
import Category from "../../src/models/category.model.js";
import Company from "../../src/models/company.model.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import User from "../../src/models/user.model.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
  DEFAULT_PASSWORD,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

vi.mock("../../src/services/mail.service.js", () => ({
  default: vi.fn().mockResolvedValue({ messageId: "test-message-id" }),
}));

const CANONICAL_LOCATION_COUNT = 64;
const CANONICAL_EMPLOYMENT_TYPE_CODES = Object.freeze([
  "FULL_TIME",
  "PART_TIME",
  "INTERNSHIP",
  "CONTRACT",
  "TEMPORARY",
  "FREELANCE",
  "SEASONAL",
  "APPRENTICESHIP",
]);
const CANONICAL_WORK_MODE_CODES = Object.freeze([
  "ONSITE",
  "HYBRID",
  "REMOTE",
]);
const CANONICAL_EXPERIENCE_LEVEL_CODES = Object.freeze([
  "NO_EXPERIENCE",
  "UNDER_1_YEAR",
  "ONE_TO_THREE_YEARS",
  "THREE_TO_FIVE_YEARS",
  "FIVE_TO_TEN_YEARS",
  "OVER_TEN_YEARS",
]);

describe("V4 Slice 05 — acceptance and regression closure (F01–F06, BR-01–BR-20)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("lets Platform Admin create FIELD → POSITION and keeps platform-scoped immutable structure", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "admin@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });
    const adminToken = await loginAndGetAccessToken(agent, {
      email: "admin@example.com",
    });

    const fieldResponse = await agent
      .post("/api/platform-admin/categories/fields")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Information Technology" });

    expect(fieldResponse.status).toBe(201);

    const fieldId = fieldResponse.body.category.id;
    const positionResponse = await agent
      .post(`/api/platform-admin/categories/fields/${fieldId}/positions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Backend Developer" });

    expect(positionResponse.status).toBe(201);
    expect(positionResponse.body.category).toMatchObject({
      level: CATEGORY_LEVEL.POSITION,
      parentCategoryId: fieldId,
    });

    const field = await Category.findById(fieldId);
    const position = await Category.findById(positionResponse.body.category.id);

    expect(field.level).toBe(CATEGORY_LEVEL.FIELD);
    expect(field.parentCategoryId).toBeNull();
    expect(position.parentCategoryId.toString()).toBe(fieldId);
    expect(field.toObject()).not.toHaveProperty("companyId");
    expect(position.toObject()).not.toHaveProperty("companyId");

    field.name = "Renamed Field";
    await field.save();
    expect((await Category.findById(fieldId)).name).toBe(
      "Information Technology",
    );

    const persistedPosition = await Category.findById(position._id);
    persistedPosition.level = CATEGORY_LEVEL.FIELD;
    await persistedPosition.save();
    expect((await Category.findById(position._id)).level).toBe(
      CATEGORY_LEVEL.POSITION,
    );

    const reparentAttempt = await Category.findById(position._id);
    const originalParentId = reparentAttempt.parentCategoryId.toString();
    reparentAttempt.parentCategoryId = new mongoose.Types.ObjectId();
    await reparentAttempt.save();
    expect(
      (await Category.findById(position._id)).parentCategoryId.toString(),
    ).toBe(originalParentId);
  });

  it("rejects Category creation by Candidate, Company Manager, and Recruiter", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "admin@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });
    await createVerifiedUser({
      email: "candidate@example.com",
      role: USER_ROLE.CANDIDATE,
    });
    const managerContext = await createActiveCompanyManagerContext({
      email: "manager@example.com",
    });
    const recruiterContext = await createActiveRecruiterContext({
      email: "recruiter@example.com",
      company: managerContext.company,
    });

    const adminToken = await loginAndGetAccessToken(agent, {
      email: "admin@example.com",
    });
    const fieldResponse = await agent
      .post("/api/platform-admin/categories/fields")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Design" });
    const fieldId = fieldResponse.body.category.id;

    const actors = [
      {
        email: "candidate@example.com",
        label: "Candidate",
      },
      {
        email: managerContext.user.email,
        label: "Company Manager",
      },
      {
        email: recruiterContext.user.email,
        label: "Recruiter",
      },
    ];

    for (const actor of actors) {
      const token = await loginAndGetAccessToken(agent, {
        email: actor.email,
      });

      const fieldDenied = await agent
        .post("/api/platform-admin/categories/fields")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: `${actor.label} Field` });

      const positionDenied = await agent
        .post(`/api/platform-admin/categories/fields/${fieldId}/positions`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: `${actor.label} Position` });

      expect(fieldDenied.status).toBe(403);
      expect(positionDenied.status).toBe(403);
    }

    expect(await Category.countDocuments({ level: CATEGORY_LEVEL.FIELD })).toBe(
      1,
    );
    expect(
      await Category.countDocuments({ level: CATEGORY_LEVEL.POSITION }),
    ).toBe(0);
  });

  it("exposes no Category or ExperienceLevel mutation/list/CRUD surfaces beyond create endpoints", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "admin@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });
    const adminToken = await loginAndGetAccessToken(agent, {
      email: "admin@example.com",
    });

    const fieldResponse = await agent
      .post("/api/platform-admin/categories/fields")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Marketing" });
    const fieldId = fieldResponse.body.category.id;

    const absentRoutes = [
      ["get", "/api/platform-admin/categories"],
      ["get", `/api/platform-admin/categories/fields/${fieldId}`],
      ["patch", `/api/platform-admin/categories/fields/${fieldId}`],
      ["put", `/api/platform-admin/categories/fields/${fieldId}`],
      ["delete", `/api/platform-admin/categories/fields/${fieldId}`],
      ["post", "/api/platform-admin/experience-levels"],
      ["get", "/api/platform-admin/experience-levels"],
      ["patch", "/api/platform-admin/experience-levels/NO_EXPERIENCE"],
      ["delete", "/api/platform-admin/experience-levels/NO_EXPERIENCE"],
      ["post", "/api/company/categories"],
      ["post", "/api/categories"],
    ];

    for (const [method, path] of absentRoutes) {
      const response = await agent[method](path).set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

      expect(response.status).toBe(404);
    }
  });

  it("keeps closed Location, EmploymentType, WorkMode vocabularies and ExperienceLevel dataset exact", async () => {
    expect(Object.values(LOCATION)).toHaveLength(CANONICAL_LOCATION_COUNT);
    expect(Object.values(LOCATION)).not.toContain("REMOTE");
    expect(LOCATION.FOREIGN).toBe("FOREIGN");
    expect(Object.values(LOCATION)).toEqual(
      expect.arrayContaining(["HA_NOI", "HO_CHI_MINH", "FOREIGN"]),
    );

    expect(Object.values(EMPLOYMENT_TYPE).sort()).toEqual(
      [...CANONICAL_EMPLOYMENT_TYPE_CODES].sort(),
    );
    expect(Object.values(WORK_MODE)).toEqual([...CANONICAL_WORK_MODE_CODES]);
    expect(WORK_MODE.REMOTE).toBe("REMOTE");
    expect(Object.values(EXPERIENCE_LEVEL).sort()).toEqual(
      [...CANONICAL_EXPERIENCE_LEVEL_CODES].sort(),
    );

    await migrateExperienceLevels();

    const experienceLevels = await ExperienceLevel.find().lean();
    const codes = experienceLevels.map((document) => document.code).sort();

    expect(experienceLevels).toHaveLength(6);
    expect(codes).toEqual([...CANONICAL_EXPERIENCE_LEVEL_CODES].sort());
    expect(
      experienceLevels.every((document) => {
        const keys = Object.keys(document).sort();

        return JSON.stringify(keys) === JSON.stringify(["_id", "code"].sort());
      }),
    ).toBe(true);
  });

  it("does not add CompanyMember catalog roles and preserves V1/V2/V3 identity surfaces", async () => {
    expect(Object.values(COMPANY_MEMBER_ROLE).sort()).toEqual([
      "COMPANY_MANAGER",
      "RECRUITER",
    ]);

    const agent = createTestAgent();
    const registration = await agent.post("/api/auth/register/candidate").send({
      fullName: "V4 Regression Candidate",
      email: "v4.regression.candidate@example.com",
      password: DEFAULT_PASSWORD,
    });

    expect(registration.status).toBe(201);

    const managerContext = await createActiveCompanyManagerContext({
      email: "v4.regression.manager@example.com",
    });
    const company = await Company.findById(managerContext.company._id).lean();
    const managerUser = await User.findById(managerContext.user._id).lean();

    expect(company).not.toHaveProperty("managerUserId");
    expect(managerUser.role).toBe(USER_ROLE.COMPANY_STAFF);
    expect(await Category.countDocuments()).toBe(0);
    expect(await ExperienceLevel.countDocuments()).toBe(0);
  });
});
