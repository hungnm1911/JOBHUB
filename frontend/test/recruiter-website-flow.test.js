import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? dom.window : dom.window[name] })
}
window.scrollTo = () => {}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { act, createElement } = await import('react')
const { createRoot } = await import('react-dom/client')
const { Provider } = await import('react-redux')
const { createMemoryRouter, RouterProvider } = await import('react-router-dom')
const vite = await createServer({ appType: 'custom', server: { middlewareMode: true, hmr: false } })
const load = (path) => vite.ssrLoadModule(`/src/${path}`)
const { store } = await load('store/store.js')
const auth = await load('features/authentication/slice.js')
const { default: apiClient } = await load('apis/client/index.js')
const { default: RootLayout } = await load('components/layouts/RootLayout.jsx')
const { default: publicRoutes } = await load('routes/public.routes.jsx')
const { default: GuestRoute } = await load('routes/components/GuestRoute.jsx')
const { default: recruiterRoutes } = await load('routes/recruiter.routes.jsx')
const { toPostLoginLocation } = await load('features/authentication/utils.js')
const originalGet = apiClient.get
after(async () => { apiClient.get = originalGet; await vite.close(); dom.window.close() })

const user = { id: 'reader', fullName: 'Minh Recruiter', role: 'COMPANY_STAFF', status: 'ACTIVE', mustChangePassword: false }
const membership = { id: 'member', companyId: 'own-company', role: 'RECRUITER', status: 'ACTIVE' }
const company = { id: 'public-company', name: 'Public Company', description: 'Public profile' }
const job = { id: 'public-job', title: 'Public Engineer', company, status: 'PUBLISHED', acceptingApplications: true, isHistoricalReadOnly: false, jobDescription: 'Public job content', fieldCategories: [], positionCategories: [], workModes: ['HYBRID'], employmentType: 'FULL_TIME', salary: { type: 'NEGOTIABLE' }, location: { provinceCode: '01' } }

async function mount(entry = '/login', { signedIn = false } = {}) {
  store.dispatch(auth.unauthenticated())
  if (signedIn) {
    store.dispatch(auth.authenticated({ user }))
    store.dispatch(auth.accountContextResolved({ membership }))
  }
  const requests = []
  apiClient.get = async (url, options = {}) => {
    requests.push({ url, options })
    if (url === '/jobs') return { data: { jobs: [{ ...job, primaryRecruiterCompanyMemberId: 'member' }], pagination: { page: 1, limit: 6, total: 1, totalPages: 1 } } }
    if (url === '/jobs/my-applications') return { data: { applications: [], currentWorkloadCount: 7 } }
    if (url === '/notifications') return { data: { notifications: [] } }
    if (url === '/job-discovery/jobs') return { data: { jobs: [job], pagination: { page: 1, totalPages: 1, total: 1 } } }
    if (url === '/job-discovery/jobs/public-job') return { data: { job } }
    if (url === '/job-discovery/companies/public-company') return { data: { company } }
    if (url === '/locations/provinces') return { data: { provinces: [{ code: '01', name: 'Hà Nội' }] } }
    if (url === '/experience-levels') return { data: { experienceLevels: [] } }
    if (url === '/categories/fields') return { data: { fields: [] } }
    throw new Error(`Unexpected request: ${url}`)
  }
  const router = createMemoryRouter([
    { path: '/', element: createElement(RootLayout), children: [...publicRoutes, { element: createElement(GuestRoute), children: [{ path: 'login', element: createElement('span', null, 'Login form') }] }] },
    { path: '/onboarding/company', element: createElement('span', null, 'Onboarding') },
    { path: '/company/recruiters', element: createElement('span', null, 'Manager workspace') },
  ], { initialEntries: [entry] })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(createElement(Provider, { store }, createElement(RouterProvider, { router }))))
  return { container, router, requests, async unmount() { await act(async () => root.unmount()); container.remove(); router.dispose() } }
}
async function dispatch(action) { await act(async () => store.dispatch(action)) }
async function navigate(view, to) { await act(async () => view.router.navigate(to)) }

function assertReadOnly(view) {
  assert.doesNotMatch(view.container.querySelector('main').textContent, /Ứng tuyển|Lưu việc làm|Đánh giá CV|Đánh giá độ phù hợp/)
  assert.equal(view.container.querySelector('button[aria-label^="Ứng tuyển"], button[aria-label^="Lưu việc làm"], button[aria-label^="Đánh giá CV"]'), null)
  assert.equal(view.container.querySelector('[aria-label*="Lưu Job"]'), null)
  assert.equal(view.container.querySelector('[aria-label*="Bỏ lưu"]'), null)
  assert.ok(view.requests.filter(({ url }) => url.startsWith('/job-discovery')).every(({ options }) => options.requiresAuthentication === true))
}

test('login waits for membership, then lands on the Recruiter website home at / without a dashboard sidebar', async () => {
  const view = await mount()
  try {
    await dispatch(auth.authenticated({ user }))
    assert.equal(view.router.state.location.pathname, '/login')
    assert.match(view.container.textContent, /Đang xác định quyền/)
    assert.equal(view.requests.some(({ url }) => url === '/jobs'), false)
    await dispatch(auth.accountContextResolved({ membership }))
    assert.equal(view.router.state.location.pathname, '/')
    assert.match(view.container.querySelector('h1').textContent, /Chào Minh Recruiter/)
    assert.match(view.container.textContent, /Job đã công bố của công ty/)
    assert.match(view.container.textContent, /Khám phá thị trường/)
    assert.ok(view.container.querySelector('footer'))
    assert.ok(view.container.querySelector('header a[href="/recruiter/jobs"]'))
    assert.equal(view.container.querySelector('[aria-label="Điều hướng chính"] a[href="/recruiter/participating"]'), null)
    assertReadOnly(view)
  } finally { await view.unmount() }
})

test('failed membership loading keeps login retryable and can recover without a wrong redirect', async () => {
  const view = await mount()
  try {
    await dispatch(auth.authenticated({ user }))
    await dispatch(auth.accountContextUnavailable())
    assert.equal(view.router.state.location.pathname, '/login')
    assert.match(view.container.textContent, /Thử lại/)
    assert.doesNotMatch(view.container.textContent, /Không thể truy cập Job Discovery/)
    await dispatch(auth.accountContextResolved({ membership }))
    assert.equal(view.router.state.location.pathname, '/')
  } finally { await view.unmount() }
})

test('Recruiter login preserves the public Job deep link and strips Candidate-only intent', async () => {
  const view = await mount({ pathname: '/login', state: { from: { pathname: '/jobs/public-job', search: '?source=shared', hash: '#job-description-heading' }, intent: { type: 'APPLY_JOB' } } })
  try {
    await dispatch(auth.authenticated({ user }))
    await dispatch(auth.accountContextResolved({ membership }))
    assert.equal(view.router.state.location.pathname, '/jobs/public-job')
    assert.equal(view.router.state.location.search, '?source=shared')
    assert.equal(view.router.state.location.hash, '#job-description-heading')
    assert.equal(view.router.state.location.state?.intent, undefined)
    assert.match(view.container.textContent, /Public job content/)
    assertReadOnly(view)
  } finally { await view.unmount() }
})

test('Recruiter can navigate discovery -> public Job -> public Company and Company Jobs, keeping all actions read-only', async () => {
  const view = await mount('/jobs?q=Engineer', { signedIn: true })
  try {
    assert.match(view.container.textContent, /Public Engineer/)
    assertReadOnly(view)
    await navigate(view, '/jobs/public-job')
    assert.match(view.container.textContent, /Public job content/)
    assert.equal([...view.container.querySelectorAll('a')].find((link) => link.textContent.includes('Quay lại danh sách việc làm'))?.getAttribute('href'), '/jobs')
    assert.ok(view.container.querySelector('a[href="/companies/public-company"]'))
    assertReadOnly(view)
    await navigate(view, '/companies/public-company')
    assert.match(view.container.textContent, /Public profile/)
    assert.match(view.container.textContent, /Vị trí đang tuyển dụng/)
    assert.equal(view.requests.filter(({ url }) => url === '/job-discovery/jobs').at(-1).options.params.companyId, 'public-company')
    assertReadOnly(view)
  } finally { await view.unmount() }
})

test('home search sends keyword and the selected Location to canonical Discovery URL encoding', async () => {
  const view = await mount('/', { signedIn: true })
  try {
    const form = view.container.querySelector('form[aria-label="Khám phá việc làm trên JOBHUB"]')
    const input = form.querySelector('input[type="search"]')
    const click = async (element) => {
      assert.ok(element)
      await act(async () => element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })))
    }
    await click([...form.querySelectorAll('button')].find((button) => button.textContent.includes('Tất cả địa điểm')))
    await click(view.container.querySelector('input[type="checkbox"][aria-label="Hà Nội"]'))
    await click([...view.container.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Áp dụng'))
    assert.equal(view.router.state.location.pathname, '/')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    await act(async () => { setter.call(input, 'React'); input.dispatchEvent(new window.Event('input', { bubbles: true })) })
    await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(view.router.state.location.pathname, '/jobs')
    assert.equal(new URLSearchParams(view.router.state.location.search).get('q'), 'React')
    assert.equal(new URLSearchParams(view.router.state.location.search).get('locations'), '01')
    const request = view.requests.filter(({ url }) => url === '/job-discovery/jobs').at(-1).options.params
    assert.equal(request.keyword, 'React')
    assert.equal(request.locations, '01')
  } finally { await view.unmount() }
})

test('Manager, onboarding, Admin and safe return defaults remain role-appropriate; /recruiter stays a workspace alias', () => {
  assert.equal(toPostLoginLocation(user, null, membership).pathname, '/')
  assert.equal(toPostLoginLocation(user, { from: '/' }, { role: 'COMPANY_MANAGER' }).pathname, '/company/recruiters')
  assert.equal(toPostLoginLocation({ ...user, status: 'PENDING_ACTIVATION' }).pathname, '/onboarding/company')
  assert.equal(toPostLoginLocation({ role: 'PLATFORM_ADMIN' }).pathname, '/admin')
  assert.equal(toPostLoginLocation(user, { from: '//outside.example' }, membership).pathname, '/')
  assert.equal(toPostLoginLocation(user, { from: '/recruiter/messages' }, membership).pathname, '/recruiter/messages')
  const index = recruiterRoutes[0].children[0].children[0].children.find((route) => route.index)
  assert.equal(index.element.props.to, '/recruiter/jobs')
})
