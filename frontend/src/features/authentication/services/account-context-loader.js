function createAccountContextLoader({
  getCurrentAccount,
  getState,
  dispatch,
  actions,
  authenticatedStatus,
  companyStaffRole,
}) {
  let pendingUser = null
  let pendingRequest = null

  function isCurrentUser(user) {
    const authentication = getState().authentication
    return authentication.status === authenticatedStatus && authentication.user === user
  }

  function load() {
    const { status, user } = getState().authentication
    if (status !== authenticatedStatus || !user) {
      return Promise.resolve(null)
    }

    if (pendingUser === user && pendingRequest) {
      return pendingRequest
    }

    dispatch(actions.accountContextLoading())

    if (user.role !== companyStaffRole) {
      dispatch(actions.accountContextResolved({ membership: null }))
      return Promise.resolve(null)
    }

    const request = (async () => {
      try {
        const account = await getCurrentAccount()
        if (!isCurrentUser(user)) {
          return null
        }
        if (account?.user?.id !== user.id) {
          throw new Error('Current account does not match the active session.')
        }

        dispatch(actions.accountContextResolved({ membership: account.membership }))
        return account.membership ?? null
      } catch {
        if (isCurrentUser(user)) {
          dispatch(actions.accountContextUnavailable())
        }
        return null
      }
    })()

    pendingUser = user
    pendingRequest = request
    request.finally(() => {
      if (pendingRequest === request) {
        pendingUser = null
        pendingRequest = null
      }
    })
    return request
  }

  return { load }
}

export { createAccountContextLoader }
