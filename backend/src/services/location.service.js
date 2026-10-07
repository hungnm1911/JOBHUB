import AppError from "../utils/app-error.js";

const LOCATION_PROVIDER_BASE_URL = "https://provinces.open-api.vn/api/v1";
const LOCATION_PROVIDER_TIMEOUT_MS = 5_000;

const LOCATION_VALIDATION_REASON = Object.freeze({
  PROVINCE_REQUIRED: "PROVINCE_REQUIRED",
  PROVINCE_NOT_FOUND: "PROVINCE_NOT_FOUND",
  DISTRICT_LEVEL_UNIT_REQUIRES_PROVINCE:
    "DISTRICT_LEVEL_UNIT_REQUIRES_PROVINCE",
  DISTRICT_LEVEL_UNIT_NOT_FOUND: "DISTRICT_LEVEL_UNIT_NOT_FOUND",
  DISTRICT_LEVEL_UNIT_NOT_IN_PROVINCE: "DISTRICT_LEVEL_UNIT_NOT_IN_PROVINCE",
});

const createProviderUnavailableError = () => {
  return new AppError(502, "Location catalog provider is unavailable", {
    reason: "LOCATION_PROVIDER_UNAVAILABLE",
  });
};

const createProviderMalformedError = () => {
  return new AppError(
    502,
    "Location catalog provider returned a malformed response",
    { reason: "LOCATION_PROVIDER_MALFORMED_RESPONSE" },
  );
};

const requestProvider = async (path) => {
  let response;

  try {
    response = await fetch(`${LOCATION_PROVIDER_BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(LOCATION_PROVIDER_TIMEOUT_MS),
    });
  } catch {
    throw createProviderUnavailableError();
  }

  if (!response.ok) {
    throw createProviderUnavailableError();
  }

  try {
    return await response.json();
  } catch {
    throw createProviderMalformedError();
  }
};

const isProviderCode = (value) => Number.isSafeInteger(value);

const isProviderName = (value) => {
  return typeof value === "string" && value.trim() !== "";
};

const assertUniqueCodes = (records) => {
  const codes = new Set(records.map((record) => record.code));

  if (codes.size !== records.length) {
    throw createProviderMalformedError();
  }
};

const normalizeProvince = (rawProvince) => {
  if (
    !rawProvince ||
    typeof rawProvince !== "object" ||
    !isProviderCode(rawProvince.code) ||
    !isProviderName(rawProvince.name)
  ) {
    throw createProviderMalformedError();
  }

  return {
    code: String(rawProvince.code),
    name: rawProvince.name,
  };
};

const normalizeDistrictLevelUnit = (rawDistrict) => {
  if (
    !rawDistrict ||
    typeof rawDistrict !== "object" ||
    !isProviderCode(rawDistrict.code) ||
    !isProviderName(rawDistrict.name) ||
    !isProviderCode(rawDistrict.province_code)
  ) {
    throw createProviderMalformedError();
  }

  return {
    code: String(rawDistrict.code),
    name: rawDistrict.name,
    provinceCode: String(rawDistrict.province_code),
  };
};

const fetchProvinces = async () => {
  const rawProvinces = await requestProvider("/p/");

  if (!Array.isArray(rawProvinces)) {
    throw createProviderMalformedError();
  }

  const provinces = rawProvinces.map(normalizeProvince);

  assertUniqueCodes(provinces);

  return provinces;
};

const fetchDistrictLevelUnitsOfProvince = async (province) => {
  const rawProvince = await requestProvider(
    `/p/${encodeURIComponent(province.code)}?depth=2`,
  );

  if (
    !rawProvince ||
    typeof rawProvince !== "object" ||
    !isProviderCode(rawProvince.code) ||
    String(rawProvince.code) !== province.code ||
    !Array.isArray(rawProvince.districts)
  ) {
    throw createProviderMalformedError();
  }

  const districtLevelUnits = rawProvince.districts.map(
    normalizeDistrictLevelUnit,
  );

  if (
    districtLevelUnits.some(
      (districtLevelUnit) => districtLevelUnit.provinceCode !== province.code,
    )
  ) {
    throw createProviderMalformedError();
  }

  assertUniqueCodes(districtLevelUnits);

  return districtLevelUnits;
};

const fetchAllDistrictLevelUnits = async () => {
  const rawDistricts = await requestProvider("/d/");

  if (!Array.isArray(rawDistricts)) {
    throw createProviderMalformedError();
  }

  const districtLevelUnits = rawDistricts.map(normalizeDistrictLevelUnit);

  assertUniqueCodes(districtLevelUnits);

  return districtLevelUnits;
};

const isNonEmptyString = (value) => {
  return typeof value === "string" && value !== "";
};

// Canonical code form is String(provider integer code); lenient forms such as
// `01` or `1.0` are not canonical.
const CANONICAL_LOCATION_CODE_PATTERN = /^(0|[1-9]\d*)$/;

const isCanonicalLocationCode = (value) => {
  return (
    typeof value === "string" && CANONICAL_LOCATION_CODE_PATTERN.test(value)
  );
};

const LOCATION_FILTER_SELECTION_KEYS = new Set(["provinceCode", "districtCodes"]);

const createInvalidLocationFilterError = (message, field) => {
  return new AppError(400, message, { field });
};

// Structural validation only: search paths never call the Location provider, so
// a well-formed but unknown or cross-Province code simply matches nothing.
const normalizeLocationFilterSelections = (locationSelections, { field }) => {
  if (locationSelections == null) {
    return [];
  }

  if (!Array.isArray(locationSelections)) {
    throw createInvalidLocationFilterError(`${field} must be an array`, field);
  }

  const selectionByProvinceCode = new Map();

  for (const entry of locationSelections) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw createInvalidLocationFilterError(
        `Each ${field} entry must be an object`,
        field,
      );
    }

    if (
      Object.keys(entry).some((key) => !LOCATION_FILTER_SELECTION_KEYS.has(key))
    ) {
      throw createInvalidLocationFilterError(
        `${field} entries only accept provinceCode and districtCodes`,
        field,
      );
    }

    const { provinceCode } = entry;
    const districtCodes = entry.districtCodes ?? [];

    if (!isCanonicalLocationCode(provinceCode)) {
      throw createInvalidLocationFilterError(
        `${field} entries require a canonical provinceCode`,
        field,
      );
    }

    if (
      !Array.isArray(districtCodes) ||
      !districtCodes.every(isCanonicalLocationCode)
    ) {
      throw createInvalidLocationFilterError(
        `${field} districtCodes must be canonical District-level unit codes`,
        field,
      );
    }

    const selection = selectionByProvinceCode.get(provinceCode) ?? {
      provinceCode,
      allDistricts: false,
      districtCodes: new Set(),
    };

    if (districtCodes.length === 0) {
      selection.allDistricts = true;
    }

    for (const districtCode of districtCodes) {
      selection.districtCodes.add(districtCode);
    }

    if (selection.allDistricts && selection.districtCodes.size > 0) {
      throw createInvalidLocationFilterError(
        "A Province selection cannot be both ALL and a District-level unit subset",
        field,
      );
    }

    selectionByProvinceCode.set(provinceCode, selection);
  }

  return [...selectionByProvinceCode.values()].map(
    ({ provinceCode, districtCodes }) => ({
      provinceCode,
      districtCodes: [...districtCodes],
    }),
  );
};

const listProvinces = async () => {
  return fetchProvinces();
};

const listDistrictLevelUnitsByProvince = async (provinceCode) => {
  const provinces = await fetchProvinces();
  const province = isNonEmptyString(provinceCode)
    ? provinces.find((candidate) => candidate.code === provinceCode)
    : undefined;

  if (!province) {
    throw new AppError(404, "Province not found", {
      field: "provinceCode",
      reason: LOCATION_VALIDATION_REASON.PROVINCE_NOT_FOUND,
    });
  }

  return fetchDistrictLevelUnitsOfProvince(province);
};

const createLocationValidationError = (message, field, reason) => {
  return new AppError(400, message, { field, reason });
};

const validateLocation = async ({ provinceCode, districtCode = null } = {}) => {
  const hasProvinceCode = provinceCode !== undefined && provinceCode !== null;
  const hasDistrictCode = districtCode !== undefined && districtCode !== null;

  if (!hasProvinceCode) {
    if (hasDistrictCode) {
      throw createLocationValidationError(
        "District-level unit requires a Province",
        "districtCode",
        LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_REQUIRES_PROVINCE,
      );
    }

    throw createLocationValidationError(
      "Province is required",
      "provinceCode",
      LOCATION_VALIDATION_REASON.PROVINCE_REQUIRED,
    );
  }

  if (!isNonEmptyString(provinceCode)) {
    throw createLocationValidationError(
      "Province code must be a non-empty string",
      "provinceCode",
      LOCATION_VALIDATION_REASON.PROVINCE_NOT_FOUND,
    );
  }

  if (hasDistrictCode && !isNonEmptyString(districtCode)) {
    throw createLocationValidationError(
      "District-level unit code must be a non-empty string",
      "districtCode",
      LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_NOT_FOUND,
    );
  }

  const provinces = await fetchProvinces();
  const province = provinces.find(
    (candidate) => candidate.code === provinceCode,
  );

  if (!province) {
    throw createLocationValidationError(
      "Province does not exist",
      "provinceCode",
      LOCATION_VALIDATION_REASON.PROVINCE_NOT_FOUND,
    );
  }

  if (!hasDistrictCode) {
    return { province, districtLevelUnit: null };
  }

  const districtLevelUnits = await fetchDistrictLevelUnitsOfProvince(province);
  const districtLevelUnit = districtLevelUnits.find(
    (candidate) => candidate.code === districtCode,
  );

  if (districtLevelUnit) {
    return { province, districtLevelUnit };
  }

  const allDistrictLevelUnits = await fetchAllDistrictLevelUnits();
  const existingDistrictLevelUnit = allDistrictLevelUnits.find(
    (candidate) => candidate.code === districtCode,
  );

  if (existingDistrictLevelUnit?.provinceCode === province.code) {
    throw createProviderMalformedError();
  }

  if (existingDistrictLevelUnit) {
    throw createLocationValidationError(
      "District-level unit does not belong to Province",
      "districtCode",
      LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_NOT_IN_PROVINCE,
    );
  }

  throw createLocationValidationError(
    "District-level unit does not exist",
    "districtCode",
    LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_NOT_FOUND,
  );
};

export {
  LOCATION_PROVIDER_BASE_URL,
  LOCATION_VALIDATION_REASON,
  isCanonicalLocationCode,
  listDistrictLevelUnitsByProvince,
  listProvinces,
  normalizeLocationFilterSelections,
  validateLocation,
};
