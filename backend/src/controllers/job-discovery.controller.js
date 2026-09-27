import {
  listDiscoverableJobs,
  getDiscoverableJobDetail,
  getPublicCompanyInfo,
} from "../services/job-discovery.service.js";

const listDiscoverableJobsHandler = async (request, response, next) => {
  try {
    const { keyword, sort, page, limit } = request.query;

    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;

    const readQueryArray = (query, baseKey) => {
      const value = query[baseKey] ?? query[`${baseKey}[]`];
      if (!value) return undefined;
      if (Array.isArray(value)) return value;
      return [value];
    };

    const parsedExperienceIds = Array.from(
      new Set(
        [
          ...readQueryArray(request.query, "experienceLevelId") ?? [],
          ...readQueryArray(request.query, "experienceLevelIds") ?? [],
        ].map(String),
      ),
    );

    const result = await listDiscoverableJobs({
      keyword,
      fieldCategoryIds: readQueryArray(request.query, "fieldCategoryIds"),
      positionCategoryIds: readQueryArray(request.query, "positionCategoryIds"),
      location: readQueryArray(request.query, "location"),
      employmentType: readQueryArray(request.query, "employmentType"),
      workModes: readQueryArray(request.query, "workModes"),
      experienceLevelIds:
        parsedExperienceIds.length > 0 ? parsedExperienceIds : undefined,
      sort,
      page: parsedPage,
      limit: parsedLimit,
    });

    return response.status(200).json({
      message: "Discoverable jobs retrieved.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};

const getDiscoverableJobDetailHandler = async (request, response, next) => {
  try {
    const result = await getDiscoverableJobDetail({
      jobId: request.params.jobId,
    });

    return response.status(200).json({
      message: "Job detail retrieved.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};

const getPublicCompanyInfoHandler = async (request, response, next) => {
  try {
    const company = await getPublicCompanyInfo({
      companyId: request.params.companyId,
    });

    return response.status(200).json({
      message: "Company public info retrieved.",
      company,
    });
  } catch (error) {
    return next(error);
  }
};

export {
  listDiscoverableJobsHandler,
  getDiscoverableJobDetailHandler,
  getPublicCompanyInfoHandler,
};
