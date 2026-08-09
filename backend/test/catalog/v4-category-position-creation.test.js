import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import USER_ROLE from "../../src/constants/user-role.js";
import Category from "../../src/models/category.model.js";
import {
  createFieldCategory,
  createPositionCategory,
} from "../../src/services/category.service.js";
import {
  createVerifiedUser,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

describe("V4 Slice 03 — Category POSITION creation (F02)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("POST /api/platform-admin/categories/fields/:fieldId/positions", () => {
    it("lets a valid Platform Admin create an immutable POSITION under an existing FIELD", async () => {
      const agent = createTestAgent();

      await createVerifiedUser({
        email: "admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
      });
      const accessToken = await loginAndGetAccessToken(agent, {
        email: "admin@example.com",
      });

      const fieldResponse = await agent
        .post("/api/platform-admin/categories/fields")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Information Technology" });

      expect(fieldResponse.status).toBe(201);

      const fieldId = fieldResponse.body.category.id;
      const fieldBefore = await Category.findById(fieldId).lean();

      const response = await agent
        .post(`/api/platform-admin/categories/fields/${fieldId}/positions`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Backend Developer" });

      expect(response.status).toBe(201);
      expect(response.body.message).toMatch(/POSITION category created/i);
      expect(response.body.category).toMatchObject({
        name: "Backend Developer",
        normalizedName: "backend developer",
        level: CATEGORY_LEVEL.POSITION,
        parentCategoryId: fieldId,
      });

      const persisted = await Category.findById(response.body.category.id).lean();
      const fieldAfter = await Category.findById(fieldId).lean();

      expect(persisted).toMatchObject({
        name: "Backend Developer",
        normalizedName: "backend developer",
        level: CATEGORY_LEVEL.POSITION,
        parentCategoryId: fieldBefore._id,
      });
      expect(persisted).not.toHaveProperty("companyId");
      expect(persisted).not.toHaveProperty("createdBy");
      expect(persisted).not.toHaveProperty("updatedAt");
      expect(fieldAfter).toEqual(fieldBefore);
    });

    it("allows the same POSITION name under different FIELDs and rejects same-FIELD duplicates", async () => {
      const agent = createTestAgent();

      await createVerifiedUser({
        email: "admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
      });
      const accessToken = await loginAndGetAccessToken(agent, {
        email: "admin@example.com",
      });

      const itField = await agent
        .post("/api/platform-admin/categories/fields")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "IT" });
      const marketingField = await agent
        .post("/api/platform-admin/categories/fields")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Marketing" });

      const itFieldId = itField.body.category.id;
      const marketingFieldId = marketingField.body.category.id;

      const firstPosition = await agent
        .post(`/api/platform-admin/categories/fields/${itFieldId}/positions`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Project Manager" });

      expect(firstPosition.status).toBe(201);

      const crossField = await agent
        .post(
          `/api/platform-admin/categories/fields/${marketingFieldId}/positions`,
        )
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Project Manager" });

      expect(crossField.status).toBe(201);
      expect(crossField.body.category.parentCategoryId).toBe(marketingFieldId);

      for (const name of [
        " project manager ",
        "Project   Manager",
        "PROJECT MANAGER",
      ]) {
        const duplicate = await agent
          .post(`/api/platform-admin/categories/fields/${itFieldId}/positions`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ name });

        expect(duplicate.status).toBe(409);
        expect(duplicate.body.error.message).toMatch(/already exists/i);
      }

      expect(
        await Category.countDocuments({ level: CATEGORY_LEVEL.POSITION }),
      ).toBe(2);
    });

    it("rejects missing parent FIELD, POSITION-as-parent, and non–Platform Admin actors", async () => {
      const agent = createTestAgent();

      await createVerifiedUser({
        email: "admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
      });
      await createVerifiedUser({
        email: "candidate@example.com",
        role: USER_ROLE.CANDIDATE,
      });
      const adminToken = await loginAndGetAccessToken(agent, {
        email: "admin@example.com",
      });
      const candidateToken = await loginAndGetAccessToken(agent, {
        email: "candidate@example.com",
      });

      const field = await createFieldCategory({ name: "Design" });
      const position = await createPositionCategory({
        name: "UI Designer",
        parentCategoryId: field.id,
      });

      const missingParent = await agent
        .post(
          "/api/platform-admin/categories/fields/507f1f77bcf86cd799439011/positions",
        )
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Graphic Designer" });

      expect(missingParent.status).toBe(404);

      const positionAsParent = await agent
        .post(
          `/api/platform-admin/categories/fields/${position.id}/positions`,
        )
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Senior UI Designer" });

      expect(positionAsParent.status).toBe(409);
      expect(positionAsParent.body.error.message).toMatch(/must be a FIELD/i);

      const candidateResponse = await agent
        .post(`/api/platform-admin/categories/fields/${field.id}/positions`)
        .set("Authorization", `Bearer ${candidateToken}`)
        .send({ name: "Product Designer" });

      expect(candidateResponse.status).toBe(403);

      expect(
        await Category.countDocuments({ level: CATEGORY_LEVEL.POSITION }),
      ).toBe(1);
    });

    it("rejects invalid parent ids and empty names", async () => {
      const agent = createTestAgent();

      await createVerifiedUser({
        email: "admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
      });
      const accessToken = await loginAndGetAccessToken(agent, {
        email: "admin@example.com",
      });
      const field = await createFieldCategory({ name: "Operations" });

      const invalidParent = await agent
        .post("/api/platform-admin/categories/fields/not-an-id/positions")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Coordinator" });

      expect(invalidParent.status).toBe(400);

      const emptyName = await agent
        .post(`/api/platform-admin/categories/fields/${field.id}/positions`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "   " });

      expect(emptyName.status).toBe(400);
      expect(await Category.countDocuments({ level: CATEGORY_LEVEL.POSITION })).toBe(
        0,
      );
    });
  });

  describe("createPositionCategory service and persistence", () => {
    it("does not leave duplicate POSITION documents under concurrent same-FIELD create", async () => {
      const field = await createFieldCategory({ name: "Data" });

      const results = await Promise.allSettled([
        createPositionCategory({
          name: "Data Scientist",
          parentCategoryId: field.id,
        }),
        createPositionCategory({
          name: " data   scientist ",
          parentCategoryId: field.id,
        }),
        createPositionCategory({
          name: "DATA SCIENTIST",
          parentCategoryId: field.id,
        }),
      ]);

      const fulfilled = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(2);
      expect(
        rejected.every(
          (result) =>
            result.reason?.statusCode === 409 &&
            /already exists/i.test(result.reason?.message),
        ),
      ).toBe(true);
      expect(
        await Category.countDocuments({
          parentCategoryId: field.id,
          level: CATEGORY_LEVEL.POSITION,
        }),
      ).toBe(1);
    });

    it("rejects schema attempts to persist POSITION without a parent", async () => {
      await expect(
        Category.create({
          name: "Orphan Position",
          level: CATEGORY_LEVEL.POSITION,
          parentCategoryId: null,
        }),
      ).rejects.toThrow(/must have a parent FIELD/i);
    });
  });
});
