import USER_ROLE from "../constants/user-role.js";
import USER_STATUS from "../constants/user-status.js";
import User from "../models/user.model.js";
import AppError from "../utils/app-error.js";

const PROFILE_READABLE_FIELDS = Object.freeze([
  "fullName",
  "avatarUrl",
  "dateOfBirth",
  "phoneNumber",
  "email",
]);

const PROFILE_WRITABLE_FIELDS = Object.freeze([
  "fullName",
  "avatarUrl",
  "dateOfBirth",
  "phoneNumber",
]);

const normalizeOptionalString = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
};

const toPublicCandidateProfile = (user) => {
  return {
    fullName: user.fullName,
    avatarUrl: user.avatarUrl ?? null,
    dateOfBirth: user.dateOfBirth ?? null,
    phoneNumber: user.phoneNumber ?? null,
    email: user.email,
  };
};

const assertCandidateProfileActor = (user) => {
  if (!user || user.role !== USER_ROLE.CANDIDATE) {
    throw new AppError(403, "Candidate access required");
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(403, "Candidate account is not active");
  }
};

const resolveOwnCandidateUser = async ({ candidateUserId }) => {
  const user = await User.findById(candidateUserId);

  if (!user) {
    throw new AppError(404, "Candidate profile not found");
  }

  assertCandidateProfileActor(user);

  return user;
};

const getOwnCandidateProfile = async ({ candidateUserId }) => {
  const user = await resolveOwnCandidateUser({ candidateUserId });

  return toPublicCandidateProfile(user);
};

const updateOwnCandidateProfile = async ({ candidateUserId, profile }) => {
  const user = await resolveOwnCandidateUser({ candidateUserId });

  const profileUpdate = {};

  for (const fieldName of PROFILE_WRITABLE_FIELDS) {
    if (!Object.hasOwn(profile, fieldName)) {
      continue;
    }

    if (fieldName === "fullName") {
      profileUpdate.fullName = profile.fullName.trim();
      continue;
    }

    if (fieldName === "dateOfBirth") {
      profileUpdate.dateOfBirth = profile.dateOfBirth;
      continue;
    }

    profileUpdate[fieldName] = normalizeOptionalString(profile[fieldName]);
  }

  if (Object.keys(profileUpdate).length === 0) {
    return toPublicCandidateProfile(user);
  }

  const updatedUser = await User.findOneAndUpdate(
    {
      _id: user._id,
      role: USER_ROLE.CANDIDATE,
      status: USER_STATUS.ACTIVE,
    },
    {
      $set: profileUpdate,
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!updatedUser) {
    throw new AppError(409, "Candidate profile could not be updated");
  }

  return toPublicCandidateProfile(updatedUser);
};

export {
  PROFILE_READABLE_FIELDS,
  PROFILE_WRITABLE_FIELDS,
  getOwnCandidateProfile,
  toPublicCandidateProfile,
  updateOwnCandidateProfile,
};
