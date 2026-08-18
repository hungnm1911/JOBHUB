import { listCandidateSearchEligibleCandidateCvs } from "../services/candidate-cv.service.js";

const normalizeQueryArray = (value) => {
  if (value == null) {
    return [];
  }

  const rawValues = Array.isArray(value) ? value : [value];
  const normalized = [];

  for (const rawValue of rawValues) {
    if (typeof rawValue !== "string") {
      continue;
    }

    for (const entry of rawValue.split(",")) {
      const trimmed = entry.trim();

      if (trimmed !== "") {
        normalized.push(trimmed);
      }
    }
  }

  return normalized;
};

const listCandidateSearchEligibleCandidateCvsHandler = async (
  request,
  response,
  next,
) => {
  try {
    const categoryIds = normalizeQueryArray(request.query?.categoryIds);
    const experienceLevelIds = normalizeQueryArray(
      request.query?.experienceLevelIds,
    );
    const skillTags = normalizeQueryArray(request.query?.skillTags);
    const preferredLocations = normalizeQueryArray(
      request.query?.preferredLocations,
    );
    const employmentTypes = normalizeQueryArray(request.query?.employmentTypes);
    const workModes = normalizeQueryArray(request.query?.workModes);

    const cvs = await listCandidateSearchEligibleCandidateCvs({
      actorUser: request.auth.user,
      filters: {
        categoryIds,
        experienceLevelIds,
        skillTags,
        preferredLocations,
        employmentTypes,
        workModes,
      },
    });

    return response.status(200).json({
      cvs,
    });
  } catch (error) {
    return next(error);
  }
};

export { listCandidateSearchEligibleCandidateCvsHandler };
