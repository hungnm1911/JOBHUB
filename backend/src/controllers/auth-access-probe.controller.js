const getProtectedAccessProbe = (request, response) => {
  return response.status(200).json({
    message: "Access granted",
    auth: {
      userId: request.auth.user._id.toString(),
      sessionId: request.auth.session._id.toString(),
      role: request.auth.user.role,
    },
  });
};

export { getProtectedAccessProbe };
