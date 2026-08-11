import {
  getOwnCandidateProfile,
  updateOwnCandidateProfile,
} from "../services/candidate-profile.service.js";

const getOwnCandidateProfileHandler = async (request, response, next) => {
  try {
    const profile = await getOwnCandidateProfile({
      candidateUserId: request.auth.user._id,
    });

    return response.status(200).json({
      profile,
    });
  } catch (error) {
    return next(error);
  }
};

const updateOwnCandidateProfileHandler = async (request, response, next) => {
  try {
    const profile = await updateOwnCandidateProfile({
      candidateUserId: request.auth.user._id,
      profile: request.body,
    });

    return response.status(200).json({
      message: "Candidate profile updated.",
      profile,
    });
  } catch (error) {
    return next(error);
  }
};

export {
  getOwnCandidateProfileHandler,
  updateOwnCandidateProfileHandler,
};
