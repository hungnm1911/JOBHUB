import assert from 'node:assert/strict'
import test from 'node:test'

import { createAccountContextLoader } from '../../src/features/authentication/services/account-context-loader.js'
import authenticationReducer, {
  accountContextLoading,
  accountContextResolved,
  accountContextUnavailable,
  authenticated,
  unauthenticated,
} from '../../src/features/authentication/slice.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

function createHarness(getCurrentAccount) {
  let authentication = authenticationReducer(undefined, { type: 'init' })
  const dispatch = (action) => {
    authentication = authenticationReducer(authentication, action)
  }
  const loader = createAccountContextLoader({
    getCurrentAccount,
    getState: () => ({ authentication }),
    dispatch,
    actions: { accountContextLoading, accountContextResolved, accountContextUnavailable },
    authenticatedStatus: 'authenticated',
    companyStaffRole: 'COMPANY_STAFF',
  })

  return { dispatch, getAuthentication: () => authentication, loader }
}

test('Company Staff membership resolves from the current account once per pending request', async () => {
  const pending = deferred()
  let calls = 0
  const harness = createHarness(() => {
    calls += 1
    return pending.promise
  })
  harness.dispatch(authenticated({ user: { id: 'recruiter-1', role: 'COMPANY_STAFF' } }))

  const first = harness.loader.load()
  const second = harness.loader.load()
  assert.equal(calls, 1)
  assert.equal(first, second)
  assert.equal(harness.getAuthentication().accountContextStatus, 'loading')

  pending.resolve({
    user: { id: 'recruiter-1' },
    membership: { role: 'RECRUITER', status: 'ACTIVE' },
  })
  await first
  assert.deepEqual(harness.getAuthentication().membership, { role: 'RECRUITER', status: 'ACTIVE' })
  assert.equal(harness.getAuthentication().accountContextStatus, 'resolved')
})

test('a stale membership response cannot overwrite a newer account or logout', async () => {
  const first = deferred()
  const second = deferred()
  let calls = 0
  const harness = createHarness(() => [first, second][calls++].promise)

  harness.dispatch(authenticated({ user: { id: 'manager-1', role: 'COMPANY_STAFF' } }))
  const oldLoad = harness.loader.load()
  harness.dispatch(authenticated({ user: { id: 'recruiter-2', role: 'COMPANY_STAFF' } }))
  const newLoad = harness.loader.load()

  second.resolve({ user: { id: 'recruiter-2' }, membership: { role: 'RECRUITER' } })
  await newLoad
  first.resolve({ user: { id: 'manager-1' }, membership: { role: 'COMPANY_MANAGER' } })
  await oldLoad
  assert.equal(harness.getAuthentication().membership.role, 'RECRUITER')

  harness.dispatch(unauthenticated())
  assert.equal(harness.getAuthentication().membership, null)
  assert.equal(harness.getAuthentication().accountContextStatus, 'unresolved')
})

test('a failed membership read stays unavailable until a successful retry', async () => {
  let calls = 0
  const harness = createHarness(async () => {
    calls += 1
    if (calls === 1) {
      throw new Error('network unavailable')
    }
    return { user: { id: 'manager-1' }, membership: { role: 'COMPANY_MANAGER' } }
  })
  harness.dispatch(authenticated({ user: { id: 'manager-1', role: 'COMPANY_STAFF' } }))

  await harness.loader.load()
  assert.equal(harness.getAuthentication().accountContextStatus, 'unavailable')

  await harness.loader.load()
  assert.equal(harness.getAuthentication().membership.role, 'COMPANY_MANAGER')
  assert.equal(harness.getAuthentication().accountContextStatus, 'resolved')
})

test('non-Company Staff accounts need no membership request', async () => {
  const harness = createHarness(() => {
    throw new Error('Unexpected account request')
  })
  harness.dispatch(authenticated({ user: { id: 'candidate-1', role: 'CANDIDATE' } }))

  await harness.loader.load()
  assert.equal(harness.getAuthentication().membership, null)
  assert.equal(harness.getAuthentication().accountContextStatus, 'resolved')
})
