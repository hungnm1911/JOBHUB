import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? dom.window : dom.window[name] })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { act, createElement, Fragment } = await import('react')
const { createRoot } = await import('react-dom/client')
const { Provider } = await import('react-redux')
const { MemoryRouter, useLocation } = await import('react-router-dom')
const vite = await createServer({ appType: 'custom', server: { middlewareMode: true, hmr: false } })
const { default: apiClient } = await vite.ssrLoadModule('/src/apis/client/index.js')
const { store } = await vite.ssrLoadModule('/src/store/store.js')
const { default: RecruiterHomePage } = await vite.ssrLoadModule('/src/pages/RecruiterHomePage.jsx')
const originalGet = apiClient.get
after(async () => { apiClient.get = originalGet; await vite.close(); dom.window.close() })

const jobId = '000000000000000000000001'
const jobs = [{ id: jobId, title: 'React Developer', status: 'PUBLISHED', workModes: ['HYBRID'], employmentType: 'FULL_TIME', applicationDeadline: '2020-01-01T00:00:00Z', location: { provinceCode: '01' }, salary: { type: 'RANGE', minAmount: 20000000, maxAmount: 30000000, period: 'MONTH' } }]
const applications = [{ id: 'application-1', candidate: { fullName: 'Ứng viên mẫu' }, job: { title: 'Job đã đóng', status: 'CLOSED' }, status: 'HIRED', isActiveWorkload: false }]

function CurrentPath() {
  const location = useLocation()
  return createElement('output', { 'data-path': true }, location.pathname + location.search)
}
async function click(element) {
  assert.ok(element)
  await act(async () => element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })))
}
async function mount(path = '/', { failJobs = false, failApplications = false } = {}) {
  const requests = []
  apiClient.get = async (url, options = {}) => {
    requests.push({ url, params: options.params })
    if (url === '/jobs') {
      if (failJobs) throw Object.assign(new Error('Cannot load Jobs'), { status: 500 })
      return { data: { jobs, pagination: { page: options.params.page, limit: 6, total: 19, totalPages: 4 } } }
    }
    if (url === '/jobs/my-applications') {
      if (failApplications) throw Object.assign(new Error('Cannot load workload'), { status: 500 })
      return { data: { applications, currentWorkloadCount: 12 } }
    }
    if (url === '/notifications') return { data: { notifications: [{ _id: 'notice-1', content: 'Thông báo riêng của người dùng', createdAt: '2026-11-27T01:00:00Z' }] } }
    if (url === '/job-discovery/jobs') return { data: { jobs: [{ ...jobs[0], id: 'market-job', title: 'Market Developer', company: { id: 'company-2', name: 'Công ty thị trường' }, fieldCategories: [], positionCategories: [] }], pagination: { page: 1, totalPages: 1, total: 1 } } }
    if (url === '/locations/provinces') return { data: { provinces: [{ code: '01', name: 'Hà Nội' }] } }
    if (url === '/experience-levels') return { data: { experienceLevels: [] } }
    if (url === '/locations/provinces/01/district-level-units') return { data: { districtLevelUnits: [] } }
    throw new Error(`Unexpected request: ${url}`)
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(createElement(Provider, { store }, createElement(MemoryRouter, { initialEntries: [path] }, createElement(Fragment, null, createElement(RecruiterHomePage), createElement(CurrentPath))))))
  return {
    container, requests,
    async unmount() { await act(async () => root.unmount()); container.remove() },
  }
}

test('Recruiter website home prioritizes internal published Jobs and links to public detail with an independent market preview', async () => {
  const view = await mount()
  try {
    assert.deepEqual(view.requests.find(({ url }) => url === '/jobs').params, { limit: 6, page: 1, scope: 'COMPANY_PUBLISHED', sort: '-createdAt', status: 'PUBLISHED' })
    assert.equal(view.requests.find(({ url }) => url === '/job-discovery/jobs').params.sort, 'NEWEST')
    assert.match(view.container.textContent, /Market Developer/)
    assert.ok(view.container.querySelector('a[href="/companies/company-2"]'))
    assert.match(view.container.textContent, /19 Job/)
    assert.match(view.container.textContent, /12 hồ sơ bạn đang xử lý/)
    assert.match(view.container.textContent, /Hết hạn/)
    assert.match(view.container.textContent, /Hồ sơ đã kết thúc · Xem lại/)
    assert.match(view.container.textContent, /Thông báo riêng của người dùng/)
    assert.equal(view.container.querySelector('a[href="/recruiter/my-applications/application-1"]')?.textContent.includes('Ứng viên mẫu'), true)
    assert.equal(view.container.querySelector('[aria-label*="Lưu Job"]'), null)
    assert.doesNotMatch(view.container.textContent, /Ứng tuyển ngay/)
    await click(view.container.querySelector(`a[href="/jobs/${jobId}"]`))
    assert.equal(view.container.querySelector('[data-path]').textContent, `/jobs/${jobId}`)
  } finally { await view.unmount() }
})

test('changing Home scope resets paging and keeps the published restriction; paging and title search stay server-side', async () => {
  const view = await mount('/?page=2&q=React')
  try {
    assert.equal(view.requests.find(({ url }) => url === '/jobs').params.q, 'React')
    await click(view.container.querySelector('button[aria-label="Phạm vi Job"]'))
    await click([...view.container.querySelectorAll('[role="option"]')].find((element) => element.textContent.includes('Tôi tham gia')))
    const scopeQuery = view.requests.filter(({ url }) => url === '/jobs').at(-1).params
    assert.equal(scopeQuery.scope, 'MY_TEAM')
    assert.equal(scopeQuery.page, 1)
    assert.equal(scopeQuery.q, 'React')
    assert.equal(scopeQuery.status, 'PUBLISHED')
    await click(view.container.querySelector('button[aria-label="Trang 2"]'))
    assert.equal(view.requests.filter(({ url }) => url === '/jobs').at(-1).params.page, 2)
    assert.equal(view.requests.filter(({ url }) => url === '/jobs/my-applications').length, 1)
  } finally { await view.unmount() }
})

test('independent read failures preserve other sections and never present unknown workload as zero', async () => {
  const failedJobs = await mount('/', { failJobs: true })
  try {
    assert.match(failedJobs.container.textContent, /Chưa tải được dữ liệu/)
    assert.match(failedJobs.container.textContent, /Ứng viên mẫu/)
    assert.match(failedJobs.container.textContent, /12 hồ sơ bạn đang xử lý/)
    assert.match(failedJobs.container.textContent, /Thông báo riêng của người dùng/)
  } finally { await failedJobs.unmount() }
  const failedApplications = await mount('/', { failApplications: true })
  try {
    assert.match(failedApplications.container.textContent, /— hồ sơ bạn đang xử lý/)
    assert.match(failedApplications.container.textContent, /React Developer/)
    assert.doesNotMatch(failedApplications.container.textContent, /0 hồ sơ bạn đang xử lý/)
  } finally { await failedApplications.unmount() }
})
