import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import Category from "../../src/models/category.model.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const createField = (name) => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.FIELD,
    parentCategoryId: null,
  });
};

const createPosition = ({ name, fieldId }) => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.POSITION,
    parentCategoryId: fieldId,
  });
};

describe("V4.2 Slice 01 — Public Category Catalog Read (F03)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
    await Category.init();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("lists every canonical FIELD publicly in deterministic name order", async () => {
    const [zebra, analytics, marketing] = await Promise.all([
      createField("Zebra Operations"),
      createField("Analytics"),
      createField("Marketing"),
    ]);
    await createPosition({ name: "Data Analyst", fieldId: analytics._id });

    const response = await createTestAgent().get("/api/categories/fields");

    expect(response.status).toBe(200);
    expect(response.body.fields).toEqual([
      {
        id: analytics._id.toString(),
        name: "Analytics",
        normalizedName: "analytics",
        level: CATEGORY_LEVEL.FIELD,
        parentCategoryId: null,
      },
      {
        id: marketing._id.toString(),
        name: "Marketing",
        normalizedName: "marketing",
        level: CATEGORY_LEVEL.FIELD,
        parentCategoryId: null,
      },
      {
        id: zebra._id.toString(),
        name: "Zebra Operations",
        normalizedName: "zebra operations",
        level: CATEGORY_LEVEL.FIELD,
        parentCategoryId: null,
      },
    ]);
  });

  it("lists only the selected FIELD's canonical POSITIONs in deterministic name order", async () => {
    const engineering = await createField("Engineering");
    const design = await createField("Design");
    const backend = await createPosition({
      name: "Backend Engineer",
      fieldId: engineering._id,
    });
    const qa = await createPosition({
      name: "Quality Engineer",
      fieldId: engineering._id,
    });
    await createPosition({ name: "Product Designer", fieldId: design._id });

    const response = await createTestAgent().get(
      `/api/categories/fields/${engineering._id}/positions`,
    );

    expect(response.status).toBe(200);
    expect(response.body.positions).toEqual([
      {
        id: backend._id.toString(),
        name: "Backend Engineer",
        normalizedName: "backend engineer",
        level: CATEGORY_LEVEL.POSITION,
        parentCategoryId: engineering._id.toString(),
      },
      {
        id: qa._id.toString(),
        name: "Quality Engineer",
        normalizedName: "quality engineer",
        level: CATEGORY_LEVEL.POSITION,
        parentCategoryId: engineering._id.toString(),
      },
    ]);
  });

  it("returns an empty POSITION set for a valid FIELD without POSITIONs", async () => {
    const emptyField = await createField("Empty Field");

    const response = await createTestAgent().get(
      `/api/categories/fields/${emptyField._id}/positions`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ positions: [] });
  });

  it("rejects an invalid, missing, or non-FIELD parent", async () => {
    const field = await createField("Engineering");
    const position = await createPosition({
      name: "Backend Engineer",
      fieldId: field._id,
    });

    const invalid = await createTestAgent().get(
      "/api/categories/fields/not-an-object-id/positions",
    );
    const missing = await createTestAgent().get(
      "/api/categories/fields/507f1f77bcf86cd799439011/positions",
    );
    const nonField = await createTestAgent().get(
      `/api/categories/fields/${position._id}/positions`,
    );

    expect(invalid.status).toBe(400);
    expect(invalid.body.error.details).toMatchObject({ field: "fieldId" });
    expect(missing.status).toBe(404);
    expect(missing.body.error.details).toMatchObject({ field: "fieldId" });
    expect(nonField.status).toBe(409);
    expect(nonField.body.error.details).toMatchObject({ field: "fieldId" });
  });

  it("declares the two canonical deterministic catalog indexes", async () => {
    const indexes = await Category.collection.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "category_field_catalog_name_idx",
          key: { level: 1, name: 1, _id: 1 },
        }),
        expect.objectContaining({
          name: "category_position_catalog_name_idx",
          key: { parentCategoryId: 1, name: 1, _id: 1 },
        }),
      ]),
    );
  });
});
