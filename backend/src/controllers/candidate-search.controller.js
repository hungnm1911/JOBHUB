import { parseOptionalListQuery } from "../utils/list-query.js";
import AppError from "../utils/app-error.js";
import {
  listCandidateSearchPage,
  previewSearchEligibleCandidateCv,
} from "../services/candidate-cv.service.js";
import { parseLocationFilterQuery } from "../utils/location-filter-query.js";

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
    const preferredLocations = parseLocationFilterQuery(
      request.query?.preferredLocations,
      "preferredLocations",
    );
    const employmentTypes = normalizeQueryArray(request.query?.employmentTypes);
    const workModes = normalizeQueryArray(request.query?.workModes);

    if (request.query.q !== undefined) throw new AppError(400, "Use keyword to search skill metadata", { field: "q" });
    const options = parseOptionalListQuery(request.query, { sorts: ["updatedAt"], defaultSort: "-updatedAt" },
      ["keyword", "categoryIds", "experienceLevelIds", "skillTags", "preferredLocations", "employmentTypes", "workModes"]);
    const result = await listCandidateSearchPage({
      options,
      actorUser: request.auth.user,
      filters: {
        keyword: request.query?.keyword,
        categoryIds,
        experienceLevelIds,
        skillTags,
        preferredLocations,
        employmentTypes,
        workModes,
      },
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const sendCandidateSearchCvPdf = (response, delivery, disposition) => {
  response.setHeader("Content-Type", delivery.mimeType);
  response.setHeader(
    "Content-Disposition",
    `${disposition}; filename="${delivery.fileName}"`,
  );
  response.setHeader("Content-Length", delivery.buffer.length);
  // V14 Preview must not leak storage URLs or invent public-access semantics.
  response.setHeader("Cache-Control", "private, no-store");

  return response.status(200).send(delivery.buffer);
};

const previewSearchEligibleCandidateCvHandler = async (
  request,
  response,
  next,
) => {
  try {
    const delivery = await previewSearchEligibleCandidateCv({
      actorUser: request.auth.user,
      candidateCvId: request.params.cvId,
    });

    return sendCandidateSearchCvPdf(response, delivery, "inline");
  } catch (error) {
    return next(error);
  }
};

export {
  listCandidateSearchEligibleCandidateCvsHandler,
  previewSearchEligibleCandidateCvHandler,
};
