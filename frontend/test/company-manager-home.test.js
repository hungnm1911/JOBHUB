import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
})
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'MutationObserver',
]) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: name === 'window' ? dom.window : dom.window[name],
  })
}
window.scrollTo = () => {}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { act, createElement } = await import('react')
const { createRoot } = await import('react-dom/client')
const { Provider } = await import('react-redux')
const { createMemoryRouter, RouterProvider } = await import('react-router-dom')
const vite = await createServer({
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
})
const load = (path) => vite.ssrLoadModule(`/src/${path}`)
const { store } = await load('store/store.js')
const auth = await load('features/authentication/slice.js')
const { default: client } = await load('apis/client/index.js')
const { default: RootLayout } = await load('components/layouts/RootLayout.jsx')
const { default: publicRoutes } = await load('routes/public.routes.jsx')
const { default: GuestRoute } = await load('routes/components/GuestRoute.jsx')
const { toPostLoginLocation } = await load('features/authentication/utils.js')
const { realtimeSocket } = await load('socket/index.js')
const originalGet = client.get
after(async () => {
  client.get = originalGet
  await vite.close()
  dom.window.close()
})

const user = {
  id: 'manager',
  fullName: 'Nguyễn Minh Anh',
  role: 'COMPANY_STAFF',
  status: 'ACTIVE',
  mustChangePassword: false,
}
const membership = {
  id: 'manager-member',
  companyId: 'company',
  role: 'COMPANY_MANAGER',
  status: 'ACTIVE',
}
const job = {
  id: 'pending-job',
  title: 'React Developer',
  status: 'PENDING_APPROVAL',
  salary: { type: 'NEGOTIABLE' },
  workModes: ['HYBRID'],
  applicationDeadline: '2099-12-31T00:00:00Z',
}
const expiredJob = {
  ...job,
  id: 'expired-job',
  title: 'QA Engineer',
  status: 'PUBLISHED',
  applicationDeadline: '2020-01-01T00:00:00Z',
}
const recruiter = {
  id: 'new-recruiter',
  fullName: 'Phạm Ngọc Lan',
  status: 'ACTIVE',
  mustChangePassword: true,
  membership: {
    status: 'ACTIVE',
    employeeCode: 'NV012',
    jobTitle: 'Recruiter',
  },
}
const pagination = (limit, total) => ({
  page: 1,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
})
const dispatch = async (action) => {
  await act(async () => store.dispatch(action))
}

async function mount({
  entry = '/',
  signedIn = true,
  overrides = {},
  pendingFailure = false,
  empty = false,
  deferred = false,
} = {}) {
  store.dispatch(auth.unauthenticated())
  if (signedIn) {
    store.dispatch(auth.authenticated({ user: { ...user, ...overrides.user } }))
    store.dispatch(
      auth.accountContextResolved({
        membership: { ...membership, ...overrides.membership },
      }),
    )
  }
  const requests = [],
    responses = []
  let fail = pendingFailure
  client.get = async (url, config = {}) => {
    requests.push({ url, config })
    let data
    if (url === '/company')
      data = {
        company: {
          id: 'company',
          name: 'Công ty Sao Việt',
          address: 'TP. Hồ Chí Minh',
          logoUrl: null,
        },
      }
    else if (url === '/company/recruiters')
      data = {
        recruiters: empty ? [] : [recruiter],
        pagination: pagination(3, empty ? 0 : 12),
      }
    else if (url === '/jobs' && config.params.status === 'PENDING_APPROVAL') {
      if (fail)
        throw Object.assign(new Error('Pending failed'), { status: 500 })
      data = {
        jobs: empty ? [] : [job],
        pagination: pagination(3, empty ? 0 : 16),
      }
    } else if (url === '/jobs' && config.params.status === 'PUBLISHED')
      data = { jobs: [expiredJob], pagination: pagination(2, 8) }
    else throw new Error(`Unexpected CM request: ${url}`)
    if (deferred)
      return new Promise((resolve) => responses.push(() => resolve({ data })))
    return { data }
  }
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: createElement(RootLayout),
        children: [
          ...publicRoutes,
          {
            element: createElement(GuestRoute),
            children: [
              {
                path: 'login',
                element: createElement('span', null, 'Login form'),
              },
            ],
          },
        ],
      },
      {
        path: '/onboarding/company',
        element: createElement('span', null, 'Onboarding'),
      },
    ],
    { initialEntries: [entry] },
  )
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () =>
    root.render(
      createElement(
        Provider,
        { store },
        createElement(RouterProvider, { router }),
      ),
    ),
  )
  return {
    container,
    router,
    requests,
    recover() {
      fail = false
    },
    async resolve() {
      await act(async () => responses.forEach((resolve) => resolve()))
    },
    async close() {
      await act(async () => root.unmount())
      container.remove()
      router.dispose()
    },
  }
}

test('CM homepage uses authenticated internal reads, BE totals and existing workspace links', async () => {
  const view = await mount()
  try {
    assert.match(
      view.container.querySelector('h1').textContent,
      /Nguyễn Minh Anh/,
    )
    const jobs = view.requests.filter(({ url }) => url === '/jobs')
    assert.deepEqual(
      jobs.map(({ config }) => config.params),
      [
        { page: 1, limit: 3, status: 'PENDING_APPROVAL', sort: '-createdAt' },
        { page: 1, limit: 2, status: 'PUBLISHED', sort: '-createdAt' },
      ],
    )
    assert.deepEqual(
      view.requests.find(({ url }) => url === '/company/recruiters').config
        .params,
      { page: 1, limit: 3, sort: '-createdAt' },
    )
    assert.equal(view.requests.length, 4)
    assert.ok(
      view.requests.every(
        ({ config }) => config.requiresAuthentication === true,
      ),
    )
    assert.equal(
      view.container.querySelector('[aria-label="Tổng số Job chờ duyệt"]')
        .textContent,
      '16',
    )
    assert.match(view.container.textContent, /Hiển thị 1 \/ 16 Job chờ duyệt/)
    assert.match(
      view.container.textContent,
      /Hiển thị 1 \/ 8 Job trong nhóm đã đăng/,
    )
    assert.match(view.container.textContent, /Hết hạn/)
    assert.match(view.container.textContent, /Chờ kích hoạt/)
    for (const href of [
      '/company/jobs/pending-job',
      '/company/jobs/expired-job?tab=applications',
      '/company/jobs/expired-job?tab=team',
      '/company/recruiters/new',
      '/company/recruiters/new-recruiter',
    ])
      assert.ok(view.container.querySelector(`a[href="${href}"]`), href)
    assert.equal(
      view.container.querySelector('[aria-label="Điều hướng Company Manager"]'),
      null,
    )
    assert.ok(
      view.container.querySelector(
        'footer [aria-label="Điều hướng doanh nghiệp"]',
      ),
    )
    assert.equal(view.container.querySelector('a[href="/jobs"]'), null)
    assert.doesNotMatch(
      view.container.querySelector('main').textContent,
      /Duyệt và đăng Job|Từ chối và xóa Job|Thay Primary|Khám phá thị trường/,
    )
  } finally {
    await view.close()
  }
})

test('switching Company Manager identity rereads every tenant-owned resource', async () => {
  const view = await mount()
  try {
    const before = view.requests.length
    await act(async () => {
      store.dispatch(auth.authenticated({ user: { ...user, id: 'other-manager', fullName: 'Manager Hai' } }))
      store.dispatch(auth.accountContextResolved({ membership: { ...membership, id: 'other-membership', companyId: 'other-company' } }))
    })
    assert.equal(view.requests.length, before + 4)
    assert.match(view.container.querySelector('h1').textContent, /Manager Hai/)
  } finally { await view.close() }
})

test('login waits for CM context, can recover a failed context and defaults to /', async () => {
  const view = await mount({ entry: '/login', signedIn: false })
  try {
    await dispatch(auth.authenticated({ user }))
    assert.equal(view.router.state.location.pathname, '/login')
    assert.match(view.container.textContent, /Đang xác định quyền/)
    assert.equal(view.requests.length, 0)
    await dispatch(auth.accountContextUnavailable())
    assert.match(view.container.textContent, /Thử lại/)
    assert.equal(view.requests.length, 0)
    await dispatch(auth.accountContextResolved({ membership }))
    assert.equal(view.router.state.location.pathname, '/')
    assert.match(
      view.container.querySelector('h1').textContent,
      /Nguyễn Minh Anh/,
    )
  } finally {
    await view.close()
  }
})

test('CM home never grants Discovery and retains only Company workspace deep links', async () => {
  const view = await mount()
  try {
    const before = view.requests.length
    for (const route of [
      '/jobs',
      '/jobs/market-job',
      '/companies/other-company',
    ]) {
      await act(async () => view.router.navigate(route))
      assert.match(
        view.container.textContent,
        /Không thể truy cập Job Discovery/,
      )
      assert.equal(view.requests.length, before)
    }
    assert.deepEqual(
      toPostLoginLocation(
        user,
        {
          from: {
            pathname: '/company/jobs/job-1',
            search: '?tab=team',
            hash: '#members',
          },
          intent: { type: 'APPLY_JOB' },
        },
        membership,
      ),
      {
        pathname: '/company/jobs/job-1',
        search: '?tab=team',
        hash: '#members',
      },
    )
    assert.equal(
      toPostLoginLocation(user, { from: '/jobs/market-job' }, membership)
        .pathname,
      '/',
    )
  } finally {
    await view.close()
  }
})

test('ineligible CM cannot load home resources', async () => {
  for (const overrides of [
    { user: { status: 'LOCKED' } },
    { user: { mustChangePassword: true } },
    { membership: { status: 'LOCKED' } },
  ]) {
    const view = await mount({ overrides })
    try {
      assert.match(
        view.container.textContent,
        /Không thể truy cập Job Discovery/,
      )
      assert.equal(view.requests.length, 0)
    } finally {
      await view.close()
    }
  }
})

test('failed pending read preserves other sections and retries independently without a fake zero', async () => {
  const view = await mount({ pendingFailure: true })
  try {
    assert.equal(
      view.container.querySelector('[aria-label="Tổng số Job chờ duyệt"]')
        .textContent,
      '—',
    )
    for (const text of [
      'Chưa tải được dữ liệu',
      'QA Engineer',
      'Phạm Ngọc Lan',
      'Công ty Sao Việt',
    ])
      assert.ok(view.container.textContent.includes(text), text)
    const before = view.requests.length
    view.recover()
    await act(async () =>
      [...view.container.querySelectorAll('button')]
        .find((button) => button.textContent === 'Tải lại')
        .click(),
    )
    assert.equal(view.requests.length, before + 1)
    assert.equal(
      view.container.querySelector('[aria-label="Tổng số Job chờ duyệt"]')
        .textContent,
      '16',
    )
  } finally {
    await view.close()
  }
})

test('loading remains unknown, and empty pending/recruiters do not remove published Jobs', async () => {
  let view = await mount({ deferred: true })
  try {
    assert.equal(
      view.container.querySelector('[aria-label="Tổng số Job chờ duyệt"]')
        .textContent,
      '—',
    )
    assert.ok(
      view.container.querySelector('[aria-label="Đang tải Job chờ duyệt"]'),
    )
    await view.resolve()
    assert.equal(
      view.container.querySelector('[aria-label="Tổng số Job chờ duyệt"]')
        .textContent,
      '16',
    )
  } finally {
    await view.close()
  }
  view = await mount({ empty: true })
  try {
    assert.equal(
      view.container.querySelector('[aria-label="Tổng số Job chờ duyệt"]')
        .textContent,
      '0',
    )
    assert.match(view.container.textContent, /Đã xử lý hết Job chờ duyệt/)
    assert.match(view.container.textContent, /Công ty chưa có Recruiter/)
    assert.match(view.container.textContent, /QA Engineer/)
  } finally {
    await view.close()
  }
})

test('focus/reconnect resynchronize all HTTP reads and unmount removes listeners', async () => {
  const listeners = new Set(realtimeSocket.listeners('connect'))
  const view = await mount()
  let closed = false
  try {
    const before = view.requests.length
    await act(async () => window.dispatchEvent(new window.Event('focus')))
    assert.equal(view.requests.length, before + 4)
    const handler = realtimeSocket
      .listeners('connect')
      .find((candidate) => !listeners.has(candidate))
    assert.ok(handler)
    await act(async () => handler())
    assert.equal(view.requests.length, before + 8)
    await view.close()
    closed = true
    assert.equal(realtimeSocket.listeners('connect').length, listeners.size)
    window.dispatchEvent(new window.Event('focus'))
    assert.equal(view.requests.length, before + 8)
  } finally {
    if (!closed) await view.close()
  }
})
