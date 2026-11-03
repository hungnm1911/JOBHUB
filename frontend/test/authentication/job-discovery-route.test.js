import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { configureStore } from '@reduxjs/toolkit'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
})
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node']) {
  globalThis[name] = name === 'window' ? dom.window : dom.window[name]
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement } = await import('react')
const { createRoot } = await import('react-dom/client')
const { Provider } = await import('react-redux')
const { createMemoryRouter, RouterProvider } = await import('react-router-dom')

const vite = await createServer({ appType: 'custom', server: { middlewareMode: true } })
const { default: JobDiscoveryRoute } = await vite.ssrLoadModule('/src/routes/components/JobDiscoveryRoute.jsx')
const { default: publicRoutes } = await vite.ssrLoadModule('/src/routes/public.routes.jsx')
const discoveryRoute = publicRoutes.find((route) => route.element?.type === JobDiscoveryRoute)

after(async () => {
  await vite.close()
  dom.window.close()
})

const discoveryPaths = ['/', '/jobs', '/jobs/job-1', '/companies/company-1']

function authentication(status, role = null, overrides = {}) {
  return {
    status,
    user: role ? { id: 'user-1', role, status: 'ACTIVE' } : null,
    membership: null,
    accountContextStatus: 'unresolved',
    ...overrides,
  }
}

async function mountRoute(auth, path = '/', initialEntries = [path]) {
  const store = configureStore({ reducer: { authentication: () => auth } })
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: discoveryRoute.element,
        children: discoveryRoute.children.map((route) => ({
          ...(route.index ? { index: true } : { path: route.path }),
          element: createElement('span', null, `Discovery page: ${route.path ?? '/'}`),
        })),
      },
      { path: '/onboarding/company', element: createElement('span', null, 'Company onboarding') },
      { path: '/origin', element: createElement('span', null, 'Previous page') },
    ],
    { initialEntries },
  )
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(
    createElement(Provider, { store }, createElement(RouterProvider, { router })),
  ))
  return {
    container,
    router,
    async unmount() {
      await act(async () => root.unmount())
      container.remove()
      router.dispose()
    },
  }
}

test('the four public discovery paths share JobDiscoveryRoute', () => {
  assert.ok(discoveryRoute)
  assert.deepEqual(
    discoveryRoute.children.map((route) => route.index ? '/' : `/${route.path.replace(':jobId', 'job-1').replace(':companyId', 'company-1')}`),
    discoveryPaths,
  )
})

for (const [actor, auth] of [
  ['Guest', authentication('unauthenticated')],
  ['Candidate', authentication('authenticated', 'CANDIDATE')],
]) {
  test(`${actor} can access each public discovery path`, async () => {
    for (const path of discoveryPaths) {
      const mounted = await mountRoute(auth, path)
      try {
        assert.match(mounted.container.textContent, /Discovery page:/)
        assert.equal(mounted.router.state.location.pathname, path)
      } finally {
        await mounted.unmount()
      }
    }
  })
}

for (const [actor, role, membership] of [
  ['Recruiter', 'COMPANY_STAFF', { role: 'RECRUITER', status: 'ACTIVE' }],
  ['Company Manager', 'COMPANY_STAFF', { role: 'COMPANY_MANAGER', status: 'ACTIVE' }],
  ['Platform Admin', 'PLATFORM_ADMIN', null],
]) {
  test(`${actor} is denied across discovery paths regardless of CompanyMember state`, async () => {
    for (const path of discoveryPaths) {
      for (const accountContextStatus of ['loading', 'unavailable', 'resolved']) {
        for (const companyMembership of membership ? [null, membership] : [null]) {
          const mounted = await mountRoute(authentication('authenticated', role, {
            membership: companyMembership,
            accountContextStatus,
          }), path)
          try {
            assert.match(mounted.container.textContent, /Không thể truy cập Job Discovery/)
            assert.doesNotMatch(mounted.container.textContent, /Discovery page:|Đang xác định quyền|Thử lại/)
          } finally {
            await mounted.unmount()
          }
        }
      }
    }
  })
}

test('Candidate access does not depend on CompanyMember context', async () => {
  const mounted = await mountRoute(authentication('authenticated', 'CANDIDATE', {
    accountContextStatus: 'unavailable',
  }), '/jobs')
  try {
    assert.match(mounted.container.textContent, /Discovery page: jobs/)
  } finally {
    await mounted.unmount()
  }
})

for (const status of ['idle', 'restoring']) {
  test(`${status} authentication shows the existing loading state`, async () => {
    const mounted = await mountRoute(authentication(status))
    try {
      assert.match(mounted.container.textContent, /Đang xác định phiên truy cập/)
      assert.doesNotMatch(mounted.container.textContent, /Discovery page:/)
    } finally {
      await mounted.unmount()
    }
  })
}

test('unavailable authentication keeps the retry state', async () => {
  const mounted = await mountRoute(authentication('temporarilyUnavailable'))
  try {
    assert.match(mounted.container.textContent, /Chưa tải được quyền truy cập/)
    assert.match(mounted.container.textContent, /Thử lại/)
    assert.doesNotMatch(mounted.container.textContent, /Discovery page:/)
  } finally {
    await mounted.unmount()
  }
})

test('PENDING_ACTIVATION still redirects to Company onboarding with replace', async () => {
  const mounted = await mountRoute(authentication('authenticated', 'COMPANY_STAFF', {
    user: { id: 'user-1', role: 'COMPANY_STAFF', status: 'PENDING_ACTIVATION' },
    accountContextStatus: 'loading',
  }), '/jobs', ['/origin', '/jobs'])
  try {
    assert.equal(mounted.router.state.location.pathname, '/onboarding/company')
    assert.match(mounted.container.textContent, /Company onboarding/)
    await act(async () => mounted.router.navigate(-1))
    assert.equal(mounted.router.state.location.pathname, '/origin')
  } finally {
    await mounted.unmount()
  }
})
