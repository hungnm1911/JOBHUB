import { listExperienceLevels } from "../services/experience-level.service.js";

const listExperienceLevelsHandler = async (request, response, next) => {
  try {
    const experienceLevels = await listExperienceLevels();

    return response.status(200).json({ experienceLevels });
  } catch (error) {
    return next(error);
  }
};

export { listExperienceLevelsHandler };
