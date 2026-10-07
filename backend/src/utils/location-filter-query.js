import AppError from "./app-error.js";

const createInvalidLocationFilterQueryError = (field) => {
  return new AppError(400, `Invalid ${field} query`, { field });
};

// Canonical V4.1 Location filter query encoding: repeatable
// `<provinceCode>[:<districtCode>|<districtCode>...]` groups separated by `;`,
// or a JSON array `[{ provinceCode, districtCodes? }]`.
const parseLocationFilterQuery = (value, field) => {
  if (value == null) {
    return [];
  }

  const rawValues = Array.isArray(value) ? value : [value];
  const selections = [];

  for (const rawValue of rawValues) {
    if (typeof rawValue !== "string") {
      throw createInvalidLocationFilterQueryError(field);
    }

    const trimmed = rawValue.trim();

    if (trimmed === "") {
      continue;
    }

    if (trimmed.startsWith("[")) {
      let parsed;

      try {
        parsed = JSON.parse(trimmed);
      } catch {
        throw createInvalidLocationFilterQueryError(field);
      }

      if (!Array.isArray(parsed)) {
        throw createInvalidLocationFilterQueryError(field);
      }

      selections.push(...parsed);
      continue;
    }

    for (const branch of trimmed.split(";")) {
      const [provinceCode, districts = "", ...rest] = branch.split(":");

      if (rest.length > 0) {
        throw createInvalidLocationFilterQueryError(field);
      }

      selections.push({
        provinceCode: provinceCode.trim(),
        districtCodes: districts
          .split("|")
          .map((districtCode) => districtCode.trim())
          .filter(Boolean),
      });
    }
  }

  return selections;
};

export { parseLocationFilterQuery };
