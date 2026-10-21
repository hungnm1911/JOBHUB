import { parseListQuery, catalogPage } from "../utils/list-query.js";
import { listExperienceLevels } from "../services/experience-level.service.js";

const listExperienceLevelsHandler = async (request, response, next) => {
  try {
    const options = parseListQuery(request.query, { optional: true });
    const experienceLevels = await listExperienceLevels();

    return response.status(200).json(catalogPage("experienceLevels", experienceLevels, options));
  } catch (error) {
    return next(error);
  }
};

export { listExperienceLevelsHandler };
