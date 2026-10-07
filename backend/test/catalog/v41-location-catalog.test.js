import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LOCATION from "../../src/constants/location.js";
import {
  LOCATION_PROVIDER_BASE_URL,
  LOCATION_VALIDATION_REASON,
  listDistrictLevelUnitsByProvince,
  listProvinces,
  validateLocation,
} from "../../src/services/location.service.js";
import { createTestAgent } from "../helpers/database.js";

const RAW_WARDS_BA_DINH = Object.freeze([
  {
    name: "Phường Phúc Xá",
    code: 1,
    division_type: "phường",
    codename: "phuong_phuc_xa",
    district_code: 1,
  },
]);

const RAW_DISTRICTS = Object.freeze([
  {
    name: "Quận Ba Đình",
    code: 1,
    division_type: "quận",
    codename: "quan_ba_dinh",
    province_code: 1,
    wards: RAW_WARDS_BA_DINH,
  },
  {
    name: "Huyện Ba Vì",
    code: 271,
    division_type: "huyện",
    codename: "huyen_ba_vi",
    province_code: 1,
    wards: [
      {
        name: "Thị trấn Tây Đằng",
        code: 9619,
        division_type: "thị trấn",
        codename: "thi_tran_tay_dang",
        district_code: 271,
      },
    ],
  },
  {
    name: "Thành phố Hà Giang",
    code: 24,
    division_type: "thành phố",
    codename: "thanh_pho_ha_giang",
    province_code: 2,
    wards: [],
  },
]);

const RAW_PROVINCES = Object.freeze([
  {
    name: "Thành phố Hà Nội",
    code: 1,
    division_type: "thành phố trung ương",
    codename: "thanh_pho_ha_noi",
    phone_code: 24,
    districts: [],
  },
  {
    name: "Tỉnh Hà Giang",
    code: 2,
    division_type: "tỉnh",
    codename: "tinh_ha_giang",
    phone_code: 219,
    districts: [],
  },
]);

const jsonResponse = (body, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};

const createProviderFetch = (overrides = {}) => {
  return vi.fn(async (input) => {
    const url = new URL(String(input));
    const path = url.pathname.replace("/api/v1", "");

    if (overrides[path]) {
      return overrides[path](url);
    }

    if (path === "/p/") {
      return jsonResponse(RAW_PROVINCES);
    }

    if (path === "/d/") {
      return jsonResponse(RAW_DISTRICTS);
    }

    const provinceMatch = path.match(/^\/p\/([^/]+)$/);

    if (provinceMatch) {
      // Mirrors live v1 lenient integer parsing ("01", "1.0" → 1).
      const requestedCode = Number(decodeURIComponent(provinceMatch[1]));
      const province = RAW_PROVINCES.find(
        (candidate) => candidate.code === requestedCode,
      );

      if (!province) {
        return jsonResponse({ detail: "invalid-province-code" }, 404);
      }

      return jsonResponse({
        ...province,
        districts:
          url.searchParams.get("depth") === "2"
            ? RAW_DISTRICTS.filter(
              (district) => district.province_code === province.code,
            )
            : [],
      });
    }

    return jsonResponse({ detail: "not-found" }, 404);
  });
};

const stubProvider = (overrides) => {
  const providerFetch = createProviderFetch(overrides);

  vi.stubGlobal("fetch", providerFetch);

  return providerFetch;
};

const requestedUrls = (providerFetch) => {
  return providerFetch.mock.calls.map(([input]) => String(input));
};

const expectAppError = async (promise, { statusCode, field, reason }) => {
  await expect(promise).rejects.toMatchObject({
    name: "AppError",
    statusCode,
    ...(field || reason
      ? {
        details: expect.objectContaining({
          ...(field ? { field } : {}),
          ...(reason ? { reason } : {}),
        }),
      }
      : {}),
  });
};

describe("V4.1 Slice 01 — Location Catalog Foundation (F01)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("Province catalog normalization", () => {
    it("normalizes raw v1 Provinces to exactly { code, name } with string codes", async () => {
      stubProvider();

      const provinces = await listProvinces();

      expect(provinces).toEqual([
        { code: "1", name: "Thành phố Hà Nội" },
        { code: "2", name: "Tỉnh Hà Giang" },
      ]);

      for (const province of provinces) {
        expect(Object.keys(province).sort()).toEqual(["code", "name"]);
        expect(typeof province.code).toBe("string");
      }
    });

    it("reads only Province Open API v1 and calls it live on every read (no cache)", async () => {
      const providerFetch = stubProvider();

      await listProvinces();
      await listProvinces();

      expect(LOCATION_PROVIDER_BASE_URL).toBe(
        "https://provinces.open-api.vn/api/v1",
      );
      expect(providerFetch).toHaveBeenCalledTimes(2);

      for (const url of requestedUrls(providerFetch)) {
        expect(url.startsWith("https://provinces.open-api.vn/api/v1/")).toBe(
          true,
        );
        expect(url).not.toContain("/api/v2");
      }
    });

    it("does not derive the catalog from the legacy V4 vocabulary or expose FOREIGN/REMOTE", async () => {
      stubProvider();

      const codes = (await listProvinces()).map((province) => province.code);

      expect(codes).not.toContain(LOCATION.FOREIGN);
      expect(codes).not.toContain("REMOTE");
      expect(codes).not.toContain(LOCATION.HA_NOI);
    });
  });

  describe("District-level unit catalog normalization by Province", () => {
    it("normalizes raw v1 Districts of the selected Province to { code, name, provinceCode }", async () => {
      stubProvider();

      const districtLevelUnits = await listDistrictLevelUnitsByProvince("1");

      expect(districtLevelUnits).toEqual([
        { code: "1", name: "Quận Ba Đình", provinceCode: "1" },
        { code: "271", name: "Huyện Ba Vì", provinceCode: "1" },
      ]);

      for (const districtLevelUnit of districtLevelUnits) {
        expect(Object.keys(districtLevelUnit).sort()).toEqual([
          "code",
          "name",
          "provinceCode",
        ]);
        expect(typeof districtLevelUnit.code).toBe("string");
        expect(typeof districtLevelUnit.provinceCode).toBe("string");
      }
    });

    it("keeps raw Ward/Commune records out of the normalized catalog", async () => {
      stubProvider();

      const districtLevelUnits = await listDistrictLevelUnitsByProvince("1");
      const serialized = JSON.stringify(districtLevelUnits);

      expect(serialized).not.toContain("wards");
      expect(serialized).not.toContain("Phường Phúc Xá");
      expect(serialized).not.toContain("Thị trấn Tây Đằng");
      expect(serialized).not.toContain("district_code");
      expect(districtLevelUnits.map((unit) => unit.code)).not.toContain("9619");
    });

    it("rejects a District-level listing for an unknown Province", async () => {
      stubProvider();

      await expectAppError(listDistrictLevelUnitsByProvince("999"), {
        statusCode: 404,
        field: "provinceCode",
        reason: LOCATION_VALIDATION_REASON.PROVINCE_NOT_FOUND,
      });
    });

    it("matches Province codes exactly and does not accept provider-lenient forms", async () => {
      const providerFetch = stubProvider();

      for (const lenientCode of ["01", "1.0", " 1", "FOREIGN", "ALL"]) {
        await expectAppError(listDistrictLevelUnitsByProvince(lenientCode), {
          statusCode: 404,
          field: "provinceCode",
        });
      }

      for (const url of requestedUrls(providerFetch)) {
        expect(url).toBe(`${LOCATION_PROVIDER_BASE_URL}/p/`);
      }
    });
  });

  describe("Semantic Location validation", () => {
    it("accepts a Province-only Location (BR-07)", async () => {
      stubProvider();

      await expect(validateLocation({ provinceCode: "1" })).resolves.toEqual({
        province: { code: "1", name: "Thành phố Hà Nội" },
        districtLevelUnit: null,
      });
      await expect(
        validateLocation({ provinceCode: "2", districtCode: null }),
      ).resolves.toEqual({
        province: { code: "2", name: "Tỉnh Hà Giang" },
        districtLevelUnit: null,
      });
    });

    it("accepts a Province + District-level unit that belongs to the Province", async () => {
      stubProvider();

      await expect(
        validateLocation({ provinceCode: "1", districtCode: "271" }),
      ).resolves.toEqual({
        province: { code: "1", name: "Thành phố Hà Nội" },
        districtLevelUnit: {
          code: "271",
          name: "Huyện Ba Vì",
          provinceCode: "1",
        },
      });
    });

    it("rejects a Province that does not exist, including legacy FOREIGN/REMOTE and lenient codes", async () => {
      stubProvider();

      for (const provinceCode of [
        "999",
        "01",
        "1.0",
        LOCATION.FOREIGN,
        "REMOTE",
        LOCATION.HA_NOI,
      ]) {
        await expectAppError(validateLocation({ provinceCode }), {
          statusCode: 400,
          field: "provinceCode",
          reason: LOCATION_VALIDATION_REASON.PROVINCE_NOT_FOUND,
        });
      }
    });

    it("rejects non-string Province codes instead of coercing numbers", async () => {
      stubProvider();

      await expectAppError(validateLocation({ provinceCode: 1 }), {
        statusCode: 400,
        field: "provinceCode",
      });
      await expectAppError(validateLocation({ provinceCode: "" }), {
        statusCode: 400,
        field: "provinceCode",
      });
    });

    it("requires a Province and rejects District-level-unit-only Locations (BR-05, BR-08)", async () => {
      const providerFetch = stubProvider();

      await expectAppError(validateLocation({}), {
        statusCode: 400,
        field: "provinceCode",
        reason: LOCATION_VALIDATION_REASON.PROVINCE_REQUIRED,
      });
      await expectAppError(validateLocation({ districtCode: "1" }), {
        statusCode: 400,
        field: "districtCode",
        reason:
          LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_REQUIRES_PROVINCE,
      });
      expect(providerFetch).not.toHaveBeenCalled();
    });

    it("rejects a District-level unit that does not exist", async () => {
      stubProvider();

      await expectAppError(
        validateLocation({ provinceCode: "1", districtCode: "99999" }),
        {
          statusCode: 400,
          field: "districtCode",
          reason: LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_NOT_FOUND,
        },
      );
    });

    it("rejects a District-level unit that belongs to another Province (BR-06)", async () => {
      stubProvider();

      await expectAppError(
        validateLocation({ provinceCode: "2", districtCode: "1" }),
        {
          statusCode: 400,
          field: "districtCode",
          reason:
            LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_NOT_IN_PROVINCE,
        },
      );
      await expectAppError(
        validateLocation({ provinceCode: "1", districtCode: "24" }),
        {
          statusCode: 400,
          field: "districtCode",
          reason:
            LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_NOT_IN_PROVINCE,
        },
      );
    });

    it("does not treat ALL or a Ward code as a District-level unit (BR-04, BR-09)", async () => {
      stubProvider();

      for (const districtCode of ["ALL", "9619", "01", ""]) {
        await expectAppError(
          validateLocation({ provinceCode: "1", districtCode }),
          {
            statusCode: 400,
            field: "districtCode",
            reason: LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_NOT_FOUND,
          },
        );
      }
    });
  });

  describe("Provider failure and malformed upstream fail closed", () => {
    const unavailable = {
      statusCode: 502,
      reason: "LOCATION_PROVIDER_UNAVAILABLE",
    };
    const malformed = {
      statusCode: 502,
      reason: "LOCATION_PROVIDER_MALFORMED_RESPONSE",
    };

    it("fails closed on network error or timeout", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new DOMException("The operation timed out.", "TimeoutError");
        }),
      );

      await expectAppError(listProvinces(), unavailable);
      await expectAppError(listDistrictLevelUnitsByProvince("1"), unavailable);
      await expectAppError(validateLocation({ provinceCode: "1" }), unavailable);
    });

    it("fails closed on non-2xx provider responses", async () => {
      stubProvider({ "/p/": () => jsonResponse({ detail: "down" }, 503) });

      await expectAppError(listProvinces(), unavailable);
      await expectAppError(validateLocation({ provinceCode: "1" }), unavailable);
    });

    it("fails closed when the District detail call fails during validation", async () => {
      stubProvider({ "/p/1": () => jsonResponse({ detail: "down" }, 500) });

      await expectAppError(
        validateLocation({ provinceCode: "1", districtCode: "1" }),
        unavailable,
      );
    });

    it("fails closed on non-JSON or non-array Province payloads", async () => {
      stubProvider({
        "/p/": () => new Response("<html>oops</html>", { status: 200 }),
      });
      await expectAppError(listProvinces(), malformed);

      stubProvider({ "/p/": () => jsonResponse({ provinces: [] }) });
      await expectAppError(listProvinces(), malformed);
    });

    it("fails closed on Province records with non-integer codes, missing names, or duplicate codes", async () => {
      for (const brokenProvinces of [
        [{ name: "Thành phố Hà Nội", code: "1" }],
        [{ name: "Thành phố Hà Nội", code: 1.5 }],
        [{ name: "", code: 1 }],
        [{ code: 1 }],
        [null],
        [
          { name: "Thành phố Hà Nội", code: 1 },
          { name: "Duplicate", code: 1 },
        ],
      ]) {
        stubProvider({ "/p/": () => jsonResponse(brokenProvinces) });

        await expectAppError(listProvinces(), malformed);
      }
    });

    it("fails closed on malformed District payloads for a Province", async () => {
      const brokenDetails = [
        { ...RAW_PROVINCES[0], districts: undefined },
        { ...RAW_PROVINCES[0], code: 2, districts: [] },
        {
          ...RAW_PROVINCES[0],
          districts: [{ name: "Quận Ba Đình", code: 1 }],
        },
        {
          ...RAW_PROVINCES[0],
          districts: [{ name: "Quận Ba Đình", code: 1, province_code: 2 }],
        },
        {
          ...RAW_PROVINCES[0],
          districts: [
            { name: "Quận Ba Đình", code: 1, province_code: 1 },
            { name: "Duplicate", code: 1, province_code: 1 },
          ],
        },
      ];

      for (const brokenDetail of brokenDetails) {
        stubProvider({ "/p/1": () => jsonResponse(brokenDetail) });

        await expectAppError(listDistrictLevelUnitsByProvince("1"), malformed);
        await expectAppError(
          validateLocation({ provinceCode: "1", districtCode: "1" }),
          malformed,
        );
      }
    });

    it("fails closed when the provider's District list contradicts the Province detail", async () => {
      stubProvider({
        "/d/": () =>
          jsonResponse([
            ...RAW_DISTRICTS,
            {
              name: "Hidden District",
              code: 500,
              province_code: 1,
              wards: [],
            },
          ]),
      });

      await expectAppError(
        validateLocation({ provinceCode: "1", districtCode: "500" }),
        malformed,
      );
    });
  });

  describe("HTTP catalog endpoints", () => {
    it("GET /api/locations/provinces returns the normalized Province catalog without authentication", async () => {
      stubProvider();

      const response = await createTestAgent().get("/api/locations/provinces");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        provinces: [
          { code: "1", name: "Thành phố Hà Nội" },
          { code: "2", name: "Tỉnh Hà Giang" },
        ],
      });
    });

    it("GET /api/locations/provinces/:provinceCode/district-level-units returns only that Province's District-level units", async () => {
      stubProvider();

      const response = await createTestAgent().get(
        "/api/locations/provinces/2/district-level-units",
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        districtLevelUnits: [
          { code: "24", name: "Thành phố Hà Giang", provinceCode: "2" },
        ],
      });
      expect(JSON.stringify(response.body)).not.toContain("wards");
    });

    it("returns 404 for an unknown or non-canonical Province code", async () => {
      stubProvider();

      for (const provinceCode of ["999", "01", "FOREIGN"]) {
        const response = await createTestAgent().get(
          `/api/locations/provinces/${provinceCode}/district-level-units`,
        );

        expect(response.status).toBe(404);
        expect(response.body.error.details).toMatchObject({
          field: "provinceCode",
          reason: LOCATION_VALIDATION_REASON.PROVINCE_NOT_FOUND,
        });
      }
    });

    it("returns 502 when the provider fails, with no fallback catalog", async () => {
      stubProvider({ "/p/": () => jsonResponse({ detail: "down" }, 503) });

      const provincesResponse = await createTestAgent().get(
        "/api/locations/provinces",
      );
      const districtsResponse = await createTestAgent().get(
        "/api/locations/provinces/1/district-level-units",
      );

      expect(provincesResponse.status).toBe(502);
      expect(provincesResponse.body.error.details).toMatchObject({
        reason: "LOCATION_PROVIDER_UNAVAILABLE",
      });
      expect(provincesResponse.body.provinces).toBeUndefined();
      expect(districtsResponse.status).toBe(502);
      expect(districtsResponse.body.districtLevelUnits).toBeUndefined();
    });
  });
});
