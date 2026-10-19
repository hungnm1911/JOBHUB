import assert from 'node:assert/strict'
import test from 'node:test'

import { createAuthenticationManager } from '../../src/features/authentication/services/authentication-manager.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

function createHarness({ persisted = null } = {}) {
  let stored = persisted
  const dispatched = []
  const socketCalls = []
  const apiCalls = { login: 0, logout: 0, refresh: 0 }
  const action = (type) => (payload) => ({ type, payload })
  const actions = {
    accessRefreshed: action('accessRefreshed'),
    authenticated: action('authenticated'),
    authenticationUnavailable: action('authenticationUnavailable'),
    restorationStarted: action('restorationStarted'),
    unauthenticated: action('unauthenticated'),
  }
  const storage = {
    clear() {
      stored = null
    },
    read() {
      return stored
    },
    updateAccess({ accessToken, session }) {
      if (!stored) {
        return false
      }
      stored = { ...stored, accessToken, session }
      return true
    },
    write(authentication) {
      stored = authentication
    },
  }
  const api = {
    async login() {
      apiCalls.login += 1
      return {
        accessToken: 'login-access',
        refreshToken: 'login-refresh',
        session: { id: 'login-session' },
        user: { id: 'user-1', role: 'CANDIDATE' },
      }
    },
    async logout() {
      apiCalls.logout += 1
    },
    async refreshAccess() {
      apiCalls.refresh += 1
      return {
        accessToken: 'refreshed-access',
        session: { id: 'session-1' },
      }
    },
    async registerCompanyManager() {
      return {
        accessToken: 'onboarding-access',
        refreshToken: 'onboarding-refresh',
        session: { id: 'onboarding-session' },
        user: { id: 'manager-1', status: 'PENDING_ACTIVATION' },
        company: { id: 'company-1' },
      }
    },
  }
  const socket = {
    connect(token) {
      socketCalls.push(['connect', token])
    },
    disconnect() {
      socketCalls.push(['disconnect'])
    },
    updateAccessToken(token) {
      socketCalls.push(['update', token])
    },
  }
  const manager = createAuthenticationManager({
    api,
    storage,
    dispatch: (value) => dispatched.push(value),
    actions,
    socket,
  })

  return {
    actions,
    api,
    apiCalls,
    dispatched,
    getStored: () => stored,
    manager,
    socketCalls,
  }
}

const persistedAuthentication = {
  accessToken: 'expired-access',
  refreshToken: 'refresh-1',
  session: { id: 'session-1' },
  user: { id: 'user-1', role: 'CANDIDATE' },
}

test('concurrent refresh callers share one operation and the coordinator resets', async () => {
  const harness = createHarness({ persisted: persistedAuthentication })
  const pending = deferred()
  harness.api.refreshAccess = async () => {
    harness.apiCalls.refresh += 1
    return pending.promise
  }

  const first = harness.manager.refreshAuthentication()
  const second = harness.manager.refreshAuthentication()
  assert.equal(harness.apiCalls.refresh, 1)

  pending.resolve({
    accessToken: 'new-access',
    session: { id: 'session-1' },
  })
  assert.deepEqual(await Promise.all([first, second]), [
    'new-access',
    'new-access',
  ])

  await harness.manager.refreshAuthentication()
  assert.equal(harness.apiCalls.refresh, 2)
})

test('an old refresh cannot overwrite a newer login session', async () => {
  const harness = createHarness({ persisted: persistedAuthentication })
  const pending = deferred()
  harness.api.refreshAccess = async () => pending.promise

  const oldRefresh = harness.manager.refreshAuthentication()
  await harness.manager.login({ email: 'candidate@example.com' })
  pending.resolve({
    accessToken: 'stale-access',
    session: { id: 'stale-session' },
  })

  await assert.rejects(oldRefresh, /superseded/)
  assert.equal(harness.getStored().accessToken, 'login-access')
  assert.equal(harness.getStored().refreshToken, 'login-refresh')
  assert.deepEqual(harness.socketCalls, [['connect', 'login-access']])
})

test('invalid refresh clears credentials, state, and socket exactly once', async () => {
  for (const status of [401, 403]) {
    const harness = createHarness({ persisted: persistedAuthentication })
    const error = Object.assign(new Error('expired'), { status })
    harness.api.refreshAccess = async () => {
      harness.apiCalls.refresh += 1
      throw error
    }

    const results = await Promise.allSettled([
      harness.manager.refreshAuthentication(),
      harness.manager.refreshAuthentication(),
    ])

    assert.deepEqual(
      results.map((result) => result.status),
      ['rejected', 'rejected'],
    )
    assert.equal(harness.apiCalls.refresh, 1)
    assert.equal(harness.getStored(), null)
    assert.equal(
      harness.dispatched.filter((item) => item.type === 'unauthenticated')
        .length,
      1,
    )
    assert.deepEqual(harness.socketCalls, [['disconnect']])
  }
})

test('infrastructure refresh failure preserves credentials and can be retried', async () => {
  const harness = createHarness({ persisted: persistedAuthentication })
  const error = Object.assign(new Error('unavailable'), { status: 503 })
  let shouldFail = true
  harness.api.refreshAccess = async () => {
    harness.apiCalls.refresh += 1
    if (shouldFail) {
      shouldFail = false
      throw error
    }
    return { accessToken: 'recovered', session: { id: 'session-1' } }
  }

  await assert.rejects(harness.manager.refreshAuthentication(), error)
  assert.equal(harness.getStored().refreshToken, 'refresh-1')

  assert.equal(await harness.manager.refreshAuthentication(), 'recovered')
  assert.equal(harness.apiCalls.refresh, 2)
})

test('bootstrap refreshes before hydrating and reports temporary failure without logout', async () => {
  const success = createHarness({ persisted: persistedAuthentication })
  await success.manager.bootstrap()

  assert.deepEqual(
    success.dispatched.map((item) => item.type),
    ['restorationStarted', 'accessRefreshed', 'authenticated'],
  )
  assert.deepEqual(success.socketCalls, [
    ['update', 'refreshed-access'],
    ['connect', 'refreshed-access'],
  ])

  const unavailable = createHarness({ persisted: persistedAuthentication })
  let backendAvailable = false
  unavailable.api.refreshAccess = async () => {
    if (!backendAvailable) {
      throw Object.assign(new Error('network down'), { code: 'ERR_NETWORK' })
    }
    return { accessToken: 'recovered', session: { id: 'session-1' } }
  }
  await assert.rejects(unavailable.manager.bootstrap())

  assert.equal(unavailable.getStored().refreshToken, 'refresh-1')
  assert.equal(
    unavailable.dispatched.at(-1).type,
    'authenticationUnavailable',
  )
  assert.equal(
    unavailable.dispatched.some((item) => item.type === 'unauthenticated'),
    false,
  )

  backendAvailable = true
  await unavailable.manager.retryBootstrap()
  assert.equal(unavailable.dispatched.at(-1).type, 'authenticated')
  assert.equal(unavailable.getStored().accessToken, 'recovered')
})

test('login synchronizes persistence, state, and realtime before returning', async () => {
  const harness = createHarness()

  const result = await harness.manager.login({
    email: 'candidate@example.com',
    password: 'password',
  })

  assert.equal(harness.getStored().refreshToken, 'login-refresh')
  assert.equal(harness.dispatched.at(-1).type, 'authenticated')
  assert.deepEqual(harness.socketCalls, [['connect', 'login-access']])
  assert.equal(result.user.id, 'user-1')
})

test('company manager registration establishes the onboarding session like login', async () => {
  const harness = createHarness({ persisted: persistedAuthentication })
  const pending = deferred()
  harness.api.refreshAccess = async () => pending.promise

  const oldRefresh = harness.manager.refreshAuthentication()
  const result = await harness.manager.registerCompanyManager({
    fullName: 'Manager',
    email: 'manager@example.com',
    password: 'password',
  })
  pending.resolve({ accessToken: 'stale-access', session: { id: 'stale' } })

  await assert.rejects(oldRefresh, /superseded/)
  assert.equal(harness.getStored().refreshToken, 'onboarding-refresh')
  assert.equal(harness.getStored().accessToken, 'onboarding-access')
  assert.equal(harness.dispatched.at(-1).type, 'authenticated')
  assert.deepEqual(harness.socketCalls, [['connect', 'onboarding-access']])
  assert.equal(result.company.id, 'company-1')
})

test('logout always clears local authentication even when backend fails', async () => {
  const harness = createHarness({ persisted: persistedAuthentication })
  harness.api.logout = async () => {
    throw Object.assign(new Error('network down'), { code: 'ERR_NETWORK' })
  }

  await assert.rejects(harness.manager.logout())

  assert.equal(harness.getStored(), null)
  assert.equal(harness.dispatched.at(-1).type, 'unauthenticated')
  assert.deepEqual(harness.socketCalls, [['disconnect']])
})
