function isInvalidRefreshCredential(error) {
  return error?.status === 401 || error?.status === 403
}

function toSerializableError(error) {
  return {
    message: error?.message ?? 'Authentication is temporarily unavailable.',
    status: error?.status ?? null,
    code: error?.code ?? null,
  }
}

function createAuthenticationManager({
  api,
  storage,
  dispatch,
  actions,
  socket,
}) {
  let refreshPromise = null
  let bootstrapPromise = null
  let invalidated = false
  let authenticationRevision = 0
  let knownRefreshToken = null

  function invalidateAuthentication() {
    if (invalidated) {
      return
    }

    invalidated = true
    knownRefreshToken = null
    authenticationRevision += 1
    storage.clear()
    dispatch(actions.unauthenticated())
    socket.disconnect()
  }

  function refreshAuthentication() {
    if (refreshPromise) {
      return refreshPromise
    }

    const persistedAuthentication = storage.read()
    if (!persistedAuthentication?.refreshToken) {
      invalidateAuthentication()
      const error = new Error('Authentication session is unavailable.')
      error.status = 401
      return Promise.reject(error)
    }

    const refreshRevision = authenticationRevision

    refreshPromise = api
      .refreshAccess(persistedAuthentication.refreshToken)
      .then((result) => {
        const currentAuthentication = storage.read()
        if (
          authenticationRevision !== refreshRevision ||
          currentAuthentication?.refreshToken !==
            persistedAuthentication.refreshToken
        ) {
          const error = new Error('Authentication session was superseded.')
          error.authenticationSuperseded = true
          throw error
        }

        const authenticationWasUpdated = storage.updateAccess({
          accessToken: result.accessToken,
          session: result.session,
        })

        if (!authenticationWasUpdated) {
          const error = new Error('Authentication session is unavailable.')
          error.status = 401
          throw error
        }

        dispatch(actions.accessRefreshed({ session: result.session }))
        socket.updateAccessToken(result.accessToken)
        return result.accessToken
      })
      .catch((error) => {
        if (
          isInvalidRefreshCredential(error) &&
          error.authenticationSuperseded !== true
        ) {
          invalidateAuthentication()
        }
        throw error
      })
      .finally(() => {
        refreshPromise = null
      })

    return refreshPromise
  }

  function establishAuthentication(authentication) {
    storage.write(authentication)
    authenticationRevision += 1
    invalidated = false
    knownRefreshToken = authentication.refreshToken
    dispatch(
      actions.authenticated({
        user: authentication.user,
        session: authentication.session,
      }),
    )
    socket.connect(authentication.accessToken)

    return authentication
  }

  async function login(credentials) {
    return establishAuthentication(await api.login(credentials))
  }

  // V02 BR-21: Company Manager registration returns the initial limited
  // onboarding session, so it is established exactly like a login.
  async function registerCompanyManager(registration) {
    return establishAuthentication(await api.registerCompanyManager(registration))
  }

  function bootstrap() {
    if (bootstrapPromise) {
      return bootstrapPromise
    }

    bootstrapPromise = (async () => {
      dispatch(actions.restorationStarted())
      const persistedAuthentication = storage.read()

      if (!persistedAuthentication?.refreshToken) {
        invalidateAuthentication()
        return null
      }

      try {
        const accessToken = await refreshAuthentication()
        const restoredAuthentication = storage.read()

        invalidated = false
        knownRefreshToken =
          restoredAuthentication?.refreshToken ?? persistedAuthentication.refreshToken
        dispatch(
          actions.authenticated({
            user: restoredAuthentication?.user ?? persistedAuthentication.user,
            session:
              restoredAuthentication?.session ?? persistedAuthentication.session,
          }),
        )
        socket.connect(accessToken)
        return restoredAuthentication
      } catch (error) {
        if (
          !isInvalidRefreshCredential(error) &&
          error.authenticationSuperseded !== true
        ) {
          dispatch(
            actions.authenticationUnavailable({
              user: persistedAuthentication.user,
              session: persistedAuthentication.session,
              error: toSerializableError(error),
            }),
          )
        }
        throw error
      }
    })()

    return bootstrapPromise
  }

  function retryBootstrap() {
    bootstrapPromise = null
    return bootstrap()
  }

  async function logout() {
    try {
      await api.logout()
    } finally {
      invalidateAuthentication()
    }
  }

  // Persisted credentials are shared by every tab while Redux state is per tab,
  // so a login, logout, or refresh written by another tab is mirrored here.
  function synchronizeExternalChange() {
    const persistedAuthentication = storage.read()

    if (!persistedAuthentication?.refreshToken) {
      if (invalidated) {
        return
      }

      invalidated = true
      knownRefreshToken = null
      authenticationRevision += 1
      dispatch(actions.unauthenticated())
      socket.disconnect()
      return
    }

    if (persistedAuthentication.refreshToken === knownRefreshToken) {
      if (persistedAuthentication.accessToken) {
        socket.updateAccessToken(persistedAuthentication.accessToken)
      }
      return
    }

    authenticationRevision += 1
    invalidated = false
    knownRefreshToken = persistedAuthentication.refreshToken
    dispatch(
      actions.authenticated({
        user: persistedAuthentication.user,
        session: persistedAuthentication.session,
      }),
    )
    socket.disconnect()

    if (persistedAuthentication.accessToken) {
      socket.connect(persistedAuthentication.accessToken)
    }
  }

  return {
    bootstrap,
    invalidateAuthentication,
    login,
    logout,
    refreshAuthentication,
    registerCompanyManager,
    retryBootstrap,
    synchronizeExternalChange,
  }
}

export { createAuthenticationManager, isInvalidRefreshCredential }
