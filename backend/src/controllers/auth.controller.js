import {
  login,
  logoutCurrentSession,
  refreshAccess,
  registerCandidate,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "../services/auth.service.js";

const registerCandidateHandler = async (request, response, next) => {
  try {
    const { fullName, email, password } = request.body;

    const user = await registerCandidate({
      fullName,
      email,
      password,
    });

    return response.status(201).json({
      message:
        "Registration successful. Please verify your email before signing in.",
      user,
    });
  } catch (error) {
    next(error);
  }
};

const verifyEmailHandler = async (request, response, next) => {
  try {
    const { token } = request.body;

    const user = await verifyEmail({ token });

    return response.status(200).json({
      message: "Email verified successfully.",
      user,
    });
  } catch (error) {
    next(error);
  }
};

const loginHandler = async (request, response, next) => {
  try {
    const { email, password } = request.body;

    const result = await login({ email, password });

    return response.status(200).json({
      message: "Login successful.",
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      session: result.session,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
};

const refreshAccessHandler = async (request, response, next) => {
  try {
    const { refreshToken } = request.body;

    const result = await refreshAccess({ refreshToken });

    return response.status(200).json({
      message: "Access refreshed successfully.",
      accessToken: result.accessToken,
      session: result.session,
    });
  } catch (error) {
    next(error);
  }
};

const logoutHandler = async (request, response, next) => {
  try {
    await logoutCurrentSession({
      sessionId: request.auth.session._id,
    });

    return response.status(200).json({
      message: "Logout successful.",
    });
  } catch (error) {
    next(error);
  }
};

const forgotPasswordHandler = async (request, response, next) => {
  try {
    const { email } = request.body;

    const result = await requestPasswordReset({ email });

    return response.status(200).json({
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

const resetPasswordHandler = async (request, response, next) => {
  try {
    const { token, password } = request.body;

    const result = await resetPassword({ token, password });

    return response.status(200).json({
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export {
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  refreshAccessHandler,
  registerCandidateHandler,
  resetPasswordHandler,
  verifyEmailHandler,
};
