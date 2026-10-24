const getProviderErrorMetadata = (error) => ({
  httpStatus: Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599
    ? error.status
    : null,
  errorCode: typeof error?.code === "string"
    && /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(error.code)
    ? error.code
    : null,
});

export { getProviderErrorMetadata };
