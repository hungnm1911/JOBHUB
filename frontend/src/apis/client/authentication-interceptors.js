function setHeader(config, name, value) {
  if (typeof config.headers?.set === 'function') {
    config.headers.set(name, value)
    return
  }

  config.headers = { ...config.headers, [name]: value }
}

function shouldRefreshAuthentication(error) {
  const config = error?.config

  return (
    error?.response?.status === 401 &&
    config?.requiresAuthentication === true &&
    config.authenticationRetryAttempted !== true
  )
}

function installAuthenticationInterceptors(
  client,
  { getAccessToken, refreshAuthentication, normalizeError, reportError },
) {
  client.interceptors.request.use((config) => {
    setHeader(config, 'Accept', 'application/json')

    if (config.requiresAuthentication === true) {
      const accessToken = getAccessToken()

      if (accessToken) {
        setHeader(config, 'Authorization', `Bearer ${accessToken}`)
      }
    }

    return config
  })

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (shouldRefreshAuthentication(error)) {
        error.config.authenticationRetryAttempted = true

        try {
          await refreshAuthentication()

          const accessToken = getAccessToken()
          if (accessToken) {
            setHeader(error.config, 'Authorization', `Bearer ${accessToken}`)
          }

          return client.request(error.config)
        } catch (refreshError) {
          return Promise.reject(normalizeError(refreshError))
        }
      }

      const normalizedError = normalizeError(error)
      reportError(normalizedError)
      return Promise.reject(normalizedError)
    },
  )
}

export { installAuthenticationInterceptors, shouldRefreshAuthentication }
