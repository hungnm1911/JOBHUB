import { AUTH_STORAGE_KEY } from '@/utils/constant'

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== ''
}

function getBrowserStorage() {
  return globalThis.localStorage
}

function clearAuthentication() {
  getBrowserStorage().removeItem(AUTH_STORAGE_KEY)
}

function readAuthentication() {
  const serializedAuthentication = getBrowserStorage().getItem(AUTH_STORAGE_KEY)

  if (!serializedAuthentication) {
    return null
  }

  try {
    const authentication = JSON.parse(serializedAuthentication)

    if (
      !isRecord(authentication) ||
      !isNonEmptyString(authentication.refreshToken) ||
      !isRecord(authentication.user)
    ) {
      clearAuthentication()
      return null
    }

    return {
      accessToken: isNonEmptyString(authentication.accessToken)
        ? authentication.accessToken
        : null,
      refreshToken: authentication.refreshToken,
      user: authentication.user,
      session: isRecord(authentication.session) ? authentication.session : null,
    }
  } catch {
    clearAuthentication()
    return null
  }
}

function writeAuthentication(authentication) {
  if (
    !isNonEmptyString(authentication?.accessToken) ||
    !isNonEmptyString(authentication?.refreshToken) ||
    !isRecord(authentication?.user)
  ) {
    throw new TypeError('Complete authentication data is required.')
  }

  getBrowserStorage().setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      accessToken: authentication.accessToken,
      refreshToken: authentication.refreshToken,
      user: authentication.user,
      session: isRecord(authentication.session) ? authentication.session : null,
    }),
  )
}

function updateAccess({ accessToken, session }) {
  if (!isNonEmptyString(accessToken)) {
    throw new TypeError('A new access token is required.')
  }

  const authentication = readAuthentication()
  if (!authentication) {
    return false
  }

  writeAuthentication({
    ...authentication,
    accessToken,
    session: isRecord(session) ? session : authentication.session,
  })
  return true
}

function getAccessToken() {
  return readAuthentication()?.accessToken ?? null
}

const authenticationStorage = Object.freeze({
  clear: clearAuthentication,
  getAccessToken,
  read: readAuthentication,
  updateAccess,
  write: writeAuthentication,
})

export default authenticationStorage
