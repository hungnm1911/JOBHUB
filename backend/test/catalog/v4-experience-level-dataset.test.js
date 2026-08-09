import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import {
  CANONICAL_EXPERIENCE_LEVEL_CODES,
  migrate,
  verify,
} from "../../src/database/migrations/v4-experience-level-dataset.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

describe("V4 Slice 04 — ExperienceLevel dataset (F06)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("ExperienceLevel persistence model", () => {
    it("persists only canonical code fields and rejects unknown codes", async () => {
      const created = await ExperienceLevel.create({
        code: EXPERIENCE_LEVEL.NO_EXPERIENCE,
      });
      const persisted = await ExperienceLevel.findById(created._id).lean();

      expect(Object.keys(persisted).sort()).toEqual(["_id", "code"].sort());
      expect(persisted.code).toBe(EXPERIENCE_LEVEL.NO_EXPERIENCE);
      expect(persisted).not.toHaveProperty("name");
      expect(persisted).not.toHaveProperty("minYears");
      expect(persisted).not.toHaveProperty("companyId");
      expect(persisted).not.toHaveProperty("isActive");

      await expect(
        ExperienceLevel.create({
          code: "SENIOR_PLUS",
        }),
      ).rejects.toThrow();
    });

    it("enforces unique ExperienceLevel codes", async () => {
      await ExperienceLevel.create({
        code: EXPERIENCE_LEVEL.UNDER_1_YEAR,
      });

      await expect(
        ExperienceLevel.create({
          code: EXPERIENCE_LEVEL.UNDER_1_YEAR,
        }),
      ).rejects.toMatchObject({
        code: 11000,
      });
    });
  });

  describe("v4-experience-level-dataset migration", () => {
    it("initializes exactly the six canonical ExperienceLevel records", async () => {
      const result = await migrate();

      expect(result.insertedCount).toBe(6);
      expect(result.totalCount).toBe(6);

      const documents = await ExperienceLevel.find().lean();
      const codes = documents.map((document) => document.code).sort();

      expect(documents).toHaveLength(6);
      expect(codes).toEqual([...CANONICAL_EXPERIENCE_LEVEL_CODES].sort());
      expect(await verify()).toMatchObject({
        ok: true,
        totalCount: 6,
      });
    });

    it("is idempotent and does not create duplicates on re-run", async () => {
      const first = await migrate();
      const second = await migrate();

      expect(first.insertedCount).toBe(6);
      expect(second.insertedCount).toBe(0);
      expect(await ExperienceLevel.countDocuments()).toBe(6);

      const duplicateCodes = await ExperienceLevel.aggregate([
        {
          $group: {
            _id: "$code",
            count: { $sum: 1 },
          },
        },
        {
          $match: {
            count: { $gt: 1 },
          },
        },
      ]);

      expect(duplicateCodes).toEqual([]);
    });

    it("fills only missing canonical codes when the dataset is partial", async () => {
      await ExperienceLevel.create({
        code: EXPERIENCE_LEVEL.NO_EXPERIENCE,
      });
      await ExperienceLevel.create({
        code: EXPERIENCE_LEVEL.OVER_TEN_YEARS,
      });

      const result = await migrate();

      expect(result.insertedCount).toBe(4);
      expect(await ExperienceLevel.countDocuments()).toBe(6);
      await expect(verify()).resolves.toMatchObject({ ok: true });
    });

    it("fails verification when a non-canonical ExperienceLevel exists", async () => {
      await migrate();

      await ExperienceLevel.collection.insertOne({
        code: "CUSTOM_LEVEL",
      });

      await expect(verify()).rejects.toThrow(/verification failed/i);
    });
  });
});
