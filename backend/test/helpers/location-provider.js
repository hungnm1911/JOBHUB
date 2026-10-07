import { vi } from "vitest";

// Raw Province Open API v1 shapes (integer codes) for a stubbed live provider.
const RAW_PROVINCES = Object.freeze([
  { name: "Thành phố Hà Nội", code: 1, division_type: "thành phố trung ương" },
  { name: "Tỉnh Hà Giang", code: 2, division_type: "tỉnh" },
  { name: "Thành phố Hồ Chí Minh", code: 79, division_type: "thành phố trung ương" },
]);

const RAW_DISTRICTS = Object.freeze([
  { name: "Quận Ba Đình", code: 1, division_type: "quận", province_code: 1 },
  { name: "Huyện Ba Vì", code: 271, division_type: "huyện", province_code: 1 },
  { name: "Thành phố Hà Giang", code: 24, division_type: "thành phố", province_code: 2 },
  { name: "Quận 1", code: 760, division_type: "quận", province_code: 79 },
]);

// Canonical decimal-string codes as persisted on JobLocation.
const TEST_LOCATION = Object.freeze({
  HA_NOI: "1",
  HA_NOI_BA_DINH: "1",
  HA_NOI_BA_VI: "271",
  HA_GIANG: "2",
  HA_GIANG_CITY: "24",
  HO_CHI_MINH: "79",
  HO_CHI_MINH_DISTRICT_1: "760",
  UNKNOWN_PROVINCE: "999",
  UNKNOWN_DISTRICT: "99999",
});

const jsonResponse = (body, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};

const createLocationProviderFetch = (overrides = {}) => {
  return vi.fn(async (input) => {
    const url = new URL(String(input));
    const path = url.pathname.replace("/api/v1", "");

    if (overrides[path]) {
      return overrides[path](url);
    }

    if (path === "/p/") {
      return jsonResponse(RAW_PROVINCES.map((province) => ({
        ...province,
        districts: [],
      })));
    }

    if (path === "/d/") {
      return jsonResponse(RAW_DISTRICTS);
    }

    const provinceMatch = path.match(/^\/p\/([^/]+)$/);

    if (provinceMatch) {
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

const stubLocationProvider = (overrides) => {
  const providerFetch = createLocationProviderFetch(overrides);

  vi.stubGlobal("fetch", providerFetch);

  return providerFetch;
};

const provinceOnlyLocation = (provinceCode = TEST_LOCATION.HA_NOI) => {
  return { provinceCode, districtCode: null };
};

export {
  jsonResponse,
  provinceOnlyLocation,
  stubLocationProvider,
  TEST_LOCATION,
};
