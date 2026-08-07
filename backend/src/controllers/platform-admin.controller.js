import { lockAccount, terminateAccount } from "../services/platform-admin.service.js";

const lockAccountHandler = async (request, response, next) => {
  try {
    const user = await lockAccount({
      targetUserId: request.params.userId,
      actorUserId: request.auth.user._id,
    });

    return response.status(200).json({
      message: "Account locked successfully.",
      user,
    });
  } catch (error) {
    next(error);
  }
};

const terminateAccountHandler = async (request, response, next) => {
  try {
    const user = await terminateAccount({
      targetUserId: request.params.userId,
      actorUserId: request.auth.user._id,
    });

    return response.status(200).json({
      message: "Account terminated successfully.",
      user,
    });
  } catch (error) {
    next(error);
  }
};

export { lockAccountHandler, terminateAccountHandler };
