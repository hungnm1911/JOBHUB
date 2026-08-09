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
import Category, {
  normalizeCategoryName,
} from "../../src/models/category.model.js";
import { createFieldCategory } from "../../src/services/category.service.js";
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

describe("V4 Slice 02 — Category FIELD creation (F01)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("POST /api/platform-admin/categories/fields", () => {
    it("lets a valid Platform Admin create an immutable platform FIELD category", async () => {
      const agent = createTestAgent();

      await createVerifiedUser({
        email: "admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
      });
      const accessToken = await loginAndGetAccessToken(agent, {
        email: "admin@example.com",
      });

      const response = await agent
        .post("/api/platform-admin/categories/fields")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Information Technology" });

      expect(response.status).toBe(201);
      expect(response.body.message).toMatch(/FIELD category created/i);
      expect(response.body.category).toMatchObject({
        name: "Information Technology",
        normalizedName: "information technology",
        level: CATEGORY_LEVEL.FIELD,
        parentCategoryId: null,
      });
      expect(response.body.category.id).toEqual(expect.any(String));

      const persisted = await Category.findById(response.body.category.id).lean();

      expect(persisted).toMatchObject({
        name: "Information Technology",
        normalizedName: "information technology",
        level: CATEGORY_LEVEL.FIELD,
        parentCategoryId: null,
      });
      expect(persisted).not.toHaveProperty("companyId");
      expect(persisted).not.toHaveProperty("createdBy");
      expect(persisted).not.toHaveProperty("isActive");
      expect(persisted).not.toHaveProperty("updatedAt");
    });

    it("rejects case and whitespace variants as duplicate FIELD identity", async () => {
      const agent = createTestAgent();

      await createVerifiedUser({
        email: "admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
      });
      const accessToken = await loginAndGetAccessToken(agent, {
        email: "admin@example.com",
      });

      const firstResponse = await agent
        .post("/api/platform-admin/categories/fields")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Backend Developer" });

      expect(firstResponse.status).toBe(201);

      for (const name of [
        " backend developer ",
        "Backend   Developer",
        "BACKEND DEVELOPER",
      ]) {
        const duplicateResponse = await agent
          .post("/api/platform-admin/categories/fields")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ name });

        expect(duplicateResponse.status).toBe(409);
        expect(duplicateResponse.body.error.message).toMatch(/already exists/i);
      }

      expect(await Category.countDocuments()).toBe(1);
    });

    it("rejects non–Platform Admin actors and unauthenticated requests", async () => {
      const agent = createTestAgent();

      await createVerifiedUser({
        email: "candidate@example.com",
        role: USER_ROLE.CANDIDATE,
      });
      const candidateToken = await loginAndGetAccessToken(agent, {
        email: "candidate@example.com",
      });

      const unauthenticated = await agent
        .post("/api/platform-admin/categories/fields")
        .send({ name: "Marketing" });

      expect(unauthenticated.status).toBe(401);

      const candidateResponse = await agent
        .post("/api/platform-admin/categories/fields")
        .set("Authorization", `Bearer ${candidateToken}`)
        .send({ name: "Marketing" });

      expect(candidateResponse.status).toBe(403);
      expect(await Category.countDocuments()).toBe(0);
    });

    it("rejects empty names and unknown body fields", async () => {
      const agent = createTestAgent();

      await createVerifiedUser({
        email: "admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
      });
      const accessToken = await loginAndGetAccessToken(agent, {
        email: "admin@example.com",
      });

      const emptyName = await agent
        .post("/api/platform-admin/categories/fields")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "   " });

      expect(emptyName.status).toBe(400);

      const withParent = await agent
        .post("/api/platform-admin/categories/fields")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "Design",
          parentCategoryId: "507f1f77bcf86cd799439011",
          level: "POSITION",
        });

      expect(withParent.status).toBe(400);
      expect(await Category.countDocuments()).toBe(0);
    });
  });

  describe("createFieldCategory service and persistence", () => {
    it("persists only canonical Category fields with derived normalizedName", async () => {
      const category = await createFieldCategory({
        name: "  Product   Management ",
      });

      expect(category).toMatchObject({
        name: "Product Management",
        normalizedName: normalizeCategoryName("Product Management"),
        level: CATEGORY_LEVEL.FIELD,
        parentCategoryId: null,
      });

      const persisted = await Category.findById(category.id).lean();
      const keys = Object.keys(persisted).sort();

      expect(keys).toEqual(
        ["_id", "level", "name", "normalizedName", "parentCategoryId"].sort(),
      );
    });

    it("does not leave duplicate FIELD documents under concurrent create", async () => {
      const results = await Promise.allSettled([
        createFieldCategory({ name: "Data Science" }),
        createFieldCategory({ name: " data   science " }),
        createFieldCategory({ name: "DATA SCIENCE" }),
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
      expect(await Category.countDocuments()).toBe(1);
    });

    it("rejects schema attempts to persist FIELD with a parent", async () => {
      await expect(
        Category.create({
          name: "Illegal Child Field",
          level: CATEGORY_LEVEL.FIELD,
          parentCategoryId: "507f1f77bcf86cd799439011",
        }),
      ).rejects.toThrow(/must not have a parent/i);
    });
  });
});
