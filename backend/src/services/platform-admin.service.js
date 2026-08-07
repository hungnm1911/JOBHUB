import mongoose from "mongoose";

import USER_ROLE from "../constants/user-role.js";
import USER_STATUS from "../constants/user-status.js";
import AuthSession from "../models/auth-session.model.js";
import User from "../models/user.model.js";
import AppError from "../utils/app-error.js";

const toPublicUser = (user) => {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const lockAccount = async ({ targetUserId, actorUserId }) => {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new AppError(400, "Invalid account id", {
      field: "userId",
    });
  }

  if (targetUserId === actorUserId.toString()) {
    throw new AppError(403, "Platform Admin cannot lock their own account", {
      field: "userId",
    });
  }

  const targetUser = await User.findById(targetUserId);

  if (!targetUser) {
    throw new AppError(404, "Account not found", {
      field: "userId",
    });
  }

  if (targetUser.role === USER_ROLE.PLATFORM_ADMIN) {
    throw new AppError(
      403,
      "Platform Admin accounts cannot be locked through this operation",
      {
        field: "userId",
      },
    );
  }

  if (targetUser.status !== USER_STATUS.ACTIVE) {
    throw new AppError(409, "Only ACTIVE accounts can be locked", {
      field: "status",
    });
  }

  targetUser.status = USER_STATUS.LOCKED;
  await targetUser.save();

  await AuthSession.deleteMany({ userId: targetUser._id });

  return toPublicUser(targetUser);
};

const TERMINATABLE_STATUSES = new Set([
  USER_STATUS.ACTIVE,
  USER_STATUS.LOCKED,
]);

const terminateAccount = async ({ targetUserId, actorUserId }) => {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new AppError(400, "Invalid account id", {
      field: "userId",
    });
  }

  if (targetUserId === actorUserId.toString()) {
    throw new AppError(
      403,
      "Platform Admin cannot terminate their own account",
      {
        field: "userId",
      },
    );
  }

  const targetUser = await User.findById(targetUserId);

  if (!targetUser) {
    throw new AppError(404, "Account not found", {
      field: "userId",
    });
  }

  if (targetUser.role === USER_ROLE.PLATFORM_ADMIN) {
    throw new AppError(
      403,
      "Platform Admin accounts cannot be terminated through this operation",
      {
        field: "userId",
      },
    );
  }

  if (!TERMINATABLE_STATUSES.has(targetUser.status)) {
    throw new AppError(409, "Only ACTIVE or LOCKED accounts can be terminated", {
      field: "status",
    });
  }

  targetUser.status = USER_STATUS.TERMINATED;
  await targetUser.save();

  await AuthSession.deleteMany({ userId: targetUser._id });

  return toPublicUser(targetUser);
};

export { lockAccount, terminateAccount };
