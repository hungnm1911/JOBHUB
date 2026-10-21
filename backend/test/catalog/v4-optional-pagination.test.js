import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFieldCategory, createPositionCategory } from "../../src/services/category.service.js";
import { migrate } from "../../src/database/migrations/v4-experience-level-dataset.js";
import { stubLocationProvider } from "../helpers/location-provider.js";
import { clearDatabase, connectTestDatabase, createTestAgent, disconnectTestDatabase } from "../helpers/database.js";

const endpoints = [
  ["/api/categories/fields", "fields"],
  ["positions", "positions"],
  ["/api/locations/provinces", "provinces"],
  ["/api/locations/provinces/1/district-level-units", "districtLevelUnits"],
  ["/api/experience-levels", "experienceLevels"],
];

describe("V4 optional pagination preserves all five legacy catalogs", () => {
  let field;
  beforeAll(connectTestDatabase);
  beforeEach(async () => {
    stubLocationProvider();
    field = await createFieldCategory({ name: "First" });
    await createFieldCategory({ name: "Second" });
    await createPositionCategory({ name: "First Position", parentCategoryId: field.id });
    await createPositionCategory({ name: "Second Position", parentCategoryId: field.id });
    await migrate();
  });
  afterEach(async () => { vi.unstubAllGlobals(); await clearDatabase(); });
  afterAll(disconnectTestDatabase);

  it.each(endpoints)("%s keeps legacy DTO and ordering; supports either or both pagination params", async (endpoint, key) => {
    const path = endpoint === "positions" ? `/api/categories/fields/${field.id}/positions` : endpoint;
    const agent = createTestAgent();
    const legacy = await agent.get(path);
    expect(legacy.status).toBe(200);
    expect(Object.keys(legacy.body)).toEqual([key]);
    expect(legacy.body[key].length).toBeGreaterThan(1);
    const total = legacy.body[key].length;
    const first = await agent.get(path).query({ limit: 1 });
    const second = await agent.get(path).query({ page: 2, limit: 1 });
    expect(first.status).toBe(200);
    expect(first.body[key]).toEqual(legacy.body[key].slice(0, 1));
    expect(second.body[key]).toEqual(legacy.body[key].slice(1, 2));
    expect(second.body.pagination).toEqual({ page: 2, limit: 1, total, totalPages: total });
    const pageOnly = await agent.get(path).query({ page: 1 });
    expect(pageOnly.body[key]).toEqual(legacy.body[key]);
    expect(pageOnly.body.pagination).toEqual({ page: 1, limit: 20, total, totalPages: 1 });
    const beyond = await agent.get(path).query({ page: 999 });
    expect(beyond.body[key]).toEqual([]);
    expect(beyond.body.pagination.total).toBe(total);
    expect((await agent.get(path)).body).toEqual(legacy.body);
  });

  it.each(endpoints)("%s strictly rejects malformed pagination before catalog read", async (endpoint) => {
    const path = endpoint === "positions" ? `/api/categories/fields/${field.id}/positions` : endpoint;
    for (const query of ["page=0", "limit=0", "limit=101", "page=-1", "page=1.5", "page=1e2", "limit=", "page=01", "page=1&page=2", "page[]=1", "page=9007199254740992"]) {
      const response = await createTestAgent().get(`${path}?${query}`);
      expect(response.status, `${path}?${query}`).toBe(400);
    }
  });
});
