import { recommendOwnDefaultCvJobs } from "../services/candidate-job-recommendation.service.js";

const recommendOwnDefaultCvJobsHandler = async (request, response, next) => {
  try {
    const recommendations = await recommendOwnDefaultCvJobs({ actorUser: request.auth.user });
    response.setHeader("Cache-Control", "private, no-store");
    return response.status(200).json({ recommendations });
  } catch (error) {
    return next(error);
  }
};

export { recommendOwnDefaultCvJobsHandler };
