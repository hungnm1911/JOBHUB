import {
  getPublicCompanyInformation,
  getPublicJobDiscoveryDetail,
  listJobDiscoveryJobs,
} from "../services/job-discovery.service.js";
import AppError from "../utils/app-error.js";

const normalizeQueryArray = (value) => {
  if (value == null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const parseCategories = (value) => {
  if (value == null) {
    return [];
  }

  const rawValues = normalizeQueryArray(value);
  const branches = [];

  for (const rawValue of rawValues) {
    if (typeof rawValue !== "string") {
      throw new AppError(400, "Invalid categories query", {
        field: "categories",
      });
    }

    const trimmed = rawValue.trim();

    if (trimmed === "") {
      continue;
    }

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      let parsed;

      try {
        parsed = JSON.parse(trimmed);
      } catch {
        throw new AppError(400, "Invalid categories query", {
          field: "categories",
        });
      }

      if (Array.isArray(parsed)) {
        branches.push(...parsed);
      } else if (parsed && typeof parsed === "object") {
        for (const [fieldId, positionIds] of Object.entries(parsed)) {
          branches.push({
            fieldId,
            positionIds: Array.isArray(positionIds)
              ? positionIds
              : positionIds == null || positionIds === ""
                ? []
                : [positionIds],
          });
        }
      } else {
        throw new AppError(400, "Invalid categories query", {
          field: "categories",
        });
      }

      continue;
    }

    for (const branch of trimmed.split(";")) {
      const [fieldId, positions = ""] = branch.split(":");

      if (!fieldId) {
        throw new AppError(400, "Invalid categories query", {
          field: "categories",
        });
      }

      branches.push({
        fieldId: fieldId.trim(),
        positionIds: positions
          .split("|")
          .map((positionId) => positionId.trim())
          .filter(Boolean),
      });
    }
  }

  return branches;
};

const createInvalidLocationsQueryError = () => {
  return new AppError(400, "Invalid locations query", { field: "locations" });
};

const parseLocations = (value) => {
  if (value == null) {
    return [];
  }

  const rawValues = normalizeQueryArray(value);
  const selections = [];

  for (const rawValue of rawValues) {
    if (typeof rawValue !== "string") {
      throw createInvalidLocationsQueryError();
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
        throw createInvalidLocationsQueryError();
      }

      if (!Array.isArray(parsed)) {
        throw createInvalidLocationsQueryError();
      }

      selections.push(...parsed);
      continue;
    }

    for (const branch of trimmed.split(";")) {
      const [provinceCode, districts = "", ...rest] = branch.split(":");

      if (rest.length > 0) {
        throw createInvalidLocationsQueryError();
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

const getPublicJobsHandler = async (request, response, next) => {
  try {
    const result = await listJobDiscoveryJobs({
      actorUser: request.auth?.user,
      filters: {
        keyword: request.query.keyword,
        categories: parseCategories(request.query.categories),
        locations: parseLocations(request.query.locations),
        workModes: normalizeQueryArray(request.query.workModes),
        employmentTypes: normalizeQueryArray(request.query.employmentTypes),
        experienceLevels: normalizeQueryArray(
          request.query.experienceLevels ?? request.query.experienceLevelIds,
        ),
        sort: request.query.sort,
        page: request.query.page,
        limit: request.query.limit,
      },
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const getPublicJobHandler = async (request, response, next) => {
  try {
    const job = await getPublicJobDiscoveryDetail({
      actorUser: request.auth?.user,
      jobId: request.params.jobId,
    });

    return response.status(200).json({ job });
  } catch (error) {
    return next(error);
  }
};

const getPublicCompanyHandler = async (request, response, next) => {
  try {
    const company = await getPublicCompanyInformation({
      actorUser: request.auth?.user,
      companyId: request.params.companyId,
    });

    return response.status(200).json({ company });
  } catch (error) {
    return next(error);
  }
};

export {
  getPublicCompanyHandler,
  getPublicJobHandler,
  getPublicJobsHandler,
};
