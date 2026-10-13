import assert from 'node:assert/strict'
import test from 'node:test'

import {
  installAuthenticationInterceptors,
  shouldRefreshAuthentication,
} from '../../src/apis/client/authentication-interceptors.js'

function createFakeClient() {
  const handlers = {}
  const requests = []
  const client = {
    interceptors: {
      request: {
        use(handler) {
          handlers.request = handler
        },
      },
      response: {
        use(success, failure) {
          handlers.responseSuccess = success
          handlers.responseFailure = failure
        },
      },
    },
    request(config) {
      requests.push(config)
      return Promise.resolve({ data: 'retried', config })
    },
  }

  return { client, handlers, requests }
}

function install({ accessToken = 'access-1', refreshAuthentication } = {}) {
  const fake = createFakeClient()
  const reportedErrors = []

  installAuthenticationInterceptors(fake.client, {
    getAccessToken: () => accessToken,
    refreshAuthentication: refreshAuthentication ?? (() => Promise.resolve()),
    normalizeError: (error) => ({ normalized: true, source: error }),
    reportError: (error) => reportedErrors.push(error),
  })

  return { ...fake, reportedErrors }
}

test('only explicit protected requests attach the access token', () => {
  const { handlers } = install()

  const protectedConfig = handlers.request({
    requiresAuthentication: true,
    headers: {},
  })
  const publicConfig = handlers.request({
    requiresAuthentication: false,
    headers: {},
  })

  assert.equal(protectedConfig.headers.Authorization, 'Bearer access-1')
  assert.equal(publicConfig.headers.Authorization, undefined)
})

test('a protected 401 refreshes and retries the request once', async () => {
  let refreshCalls = 0
  const { handlers, requests } = install({
    accessToken: 'access-2',
    refreshAuthentication: async () => {
      refreshCalls += 1
    },
  })
  const config = { requiresAuthentication: true, headers: {} }

  const response = await handlers.responseFailure({
    config,
    response: { status: 401 },
  })

  assert.equal(response.data, 'retried')
  assert.equal(refreshCalls, 1)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].authenticationRetryAttempted, true)
  assert.equal(requests[0].headers.Authorization, 'Bearer access-2')

  await assert.rejects(
    handlers.responseFailure({ config, response: { status: 401 } }),
    (error) => error.normalized === true,
  )
  assert.equal(refreshCalls, 1)
  assert.equal(requests.length, 1)
})

test('public 401 and protected 403 never enter refresh', async () => {
  let refreshCalls = 0
  const { handlers } = install({
    refreshAuthentication: async () => {
      refreshCalls += 1
    },
  })

  await assert.rejects(
    handlers.responseFailure({
      config: { requiresAuthentication: false },
      response: { status: 401 },
    }),
  )
  await assert.rejects(
    handlers.responseFailure({
      config: { requiresAuthentication: true },
      response: { status: 403 },
    }),
  )

  assert.equal(refreshCalls, 0)
})

test('refresh policy rejects a request already retried', () => {
  assert.equal(
    shouldRefreshAuthentication({
      config: {
        requiresAuthentication: true,
        authenticationRetryAttempted: true,
      },
      response: { status: 401 },
    }),
    false,
  )
})
