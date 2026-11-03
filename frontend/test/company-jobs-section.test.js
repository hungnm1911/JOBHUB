import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { configureStore } from '@reduxjs/toolkit'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  globalThis[name] = name === 'window' ? dom.window : dom.window[name]
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement } = await import('react')
const { createRoot } = await import('react-dom/client')
const { Provider } = await import('react-redux')
const { MemoryRouter } = await import('react-router-dom')
const vite = await createServer({ appType: 'custom', server: { middlewareMode: true } })
const { default: apiClient } = await vite.ssrLoadModule('/src/apis/client/index.js')
const { ApiError } = await vite.ssrLoadModule('/src/apis/client/api-error.js')
const { listDiscoveryJobsApi } = await vite.ssrLoadModule('/src/apis/job-discovery.api.js')
const { default: CompanyProfile } = await vite.ssrLoadModule('/src/features/job-discovery/components/CompanyProfile.jsx')
const { default: CompanyJobsSection } = await vite.ssrLoadModule('/src/features/job-discovery/components/CompanyJobsSection.jsx')
const { default: HomeHero } = await vite.ssrLoadModule('/src/features/job-discovery/components/HomeHero.jsx')
const { default: JobSearchResults } = await vite.ssrLoadModule('/src/features/job-discovery/components/JobSearchResults.jsx')
const { parseJobSearch } = await vite.ssrLoadModule('/src/features/job-discovery/search-params.js')

const originalAdapter = apiClient.defaults.adapter
const requests = []
let respond = () => ({ jobs: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }, sort: 'NEWEST' })
apiClient.defaults.adapter = async (config) => {
  if (config.url === '/categories/fields') {
    return { data: { fields: [] }, status: 200, statusText: 'OK', headers: {}, config }
  }
  if (config.url === '/locations/provinces') {
    return { data: { provinces: [{ code: 'HNI', name: 'Hà Nội' }] }, status: 200, statusText: 'OK', headers: {}, config }
  }
  requests.push(config)
  const data = await respond(config)
  return { data, status: 200, statusText: 'OK', headers: {}, config }
}

after(async () => {
  apiClient.defaults.adapter = originalAdapter
  await vite.close()
  dom.window.close()
})

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function list(jobs = [], page = 1, total = jobs.length) {
  return { jobs, pagination: { page, limit: 10, total, totalPages: Math.ceil(total / 10) }, sort: 'NEWEST' }
}

function job(id, companyId) {
  return {
    id,
    title: `Job ${id}`,
    company: { id: companyId, name: `Company ${companyId}` },
    fieldCategories: [], positionCategories: [], workModes: [], location: { provinceCode: 'HNI' },
  }
}

function profile(id) {
  return { company: { id, name: `Company ${id}`, description: `Profile ${id}` } }
}

function auth(role) {
  return {
    status: role ? 'authenticated' : 'unauthenticated',
    user: role ? { id: 'candidate-1', role } : null,
  }
}

async function mount(Component, props, role = null) {
  const store = configureStore({ reducer: { authentication: () => auth(role) } })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const render = async (nextProps) => act(async () => root.render(
    createElement(Provider, { store }, createElement(MemoryRouter, null, createElement(Component, nextProps))),
  ))
  await render(props)
  return {
    container,
    render,
    async unmount() {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

async function click(element) {
  await act(async () => element.dispatchEvent(new window.MouseEvent('click', { bubbles: true })))
}

test('API client sends optional companyId with existing params and optional authentication', async () => {
  requests.length = 0
  respond = () => list()
  await listDiscoveryJobsApi({ companyId: 'company-1', keyword: 'React', page: 2, limit: 10, sort: 'NEWEST' })
  assert.equal(requests[0].url, '/job-discovery/jobs')
  assert.equal(requests[0].requiresAuthentication, true)
  assert.deepEqual({
    companyId: requests[0].params.companyId,
    keyword: requests[0].params.keyword,
    page: requests[0].params.page,
    limit: requests[0].params.limit,
    sort: requests[0].params.sort,
  }, { companyId: 'company-1', keyword: 'React', page: 2, limit: 10, sort: 'NEWEST' })
  await listDiscoveryJobsApi({ page: 1 })
  assert.equal(requests[1].params.companyId, undefined)
  assert.equal(requests[1].requiresAuthentication, true)
  assert.equal(apiClient.getUri(requests[1]).includes('companyId='), false)
})

test('Company Jobs waits for profile, shows skeleton then current Company jobs and detail links', async () => {
  requests.length = 0
  const companyWait = deferred()
  const jobsWait = deferred()
  respond = (config) => config.url.includes('/companies/') ? companyWait.promise : jobsWait.promise
  const mounted = await mount(CompanyProfile, { companyId: 'company-1' })
  assert.equal(requests.filter((request) => request.url === '/job-discovery/jobs').length, 0)
  assert.equal(mounted.container.querySelector('#company-jobs-heading'), null)

  await act(async () => companyWait.resolve(profile('company-1')))
  assert.equal(requests.filter((request) => request.url === '/job-discovery/jobs').length, 1)
  assert.equal(requests.at(-1).params.companyId, 'company-1')
  assert.equal(requests.at(-1).params.sort, 'NEWEST')
  assert.equal(requests.at(-1).params.limit, 10)
  assert.ok(mounted.container.querySelector('[aria-label="Đang tải việc làm"]'))

  await act(async () => jobsWait.resolve(list([job('a', 'company-1')], 1, 1)))
  assert.match(mounted.container.textContent, /Vị trí đang tuyển dụng/)
  assert.match(mounted.container.textContent, /1 vị trí/)
  assert.match(mounted.container.textContent, /Job a/)
  assert.match(mounted.container.textContent, /Hà Nội/)
  assert.equal(mounted.container.querySelector('a[href="/jobs/a"]').textContent, 'Job a')
  await mounted.unmount()
})

test('empty state uses the Company message', async () => {
  respond = () => list()
  const mounted = await mount(CompanyJobsSection, { companyId: 'company-1' })
  assert.match(mounted.container.textContent, /0 vị trí/)
  assert.match(mounted.container.textContent, /Công ty hiện chưa có vị trí đang tuyển dụng/)
  await mounted.unmount()
})

test('Jobs failure preserves profile and retry only reloads Jobs', async () => {
  requests.length = 0
  let attempts = 0
  respond = (config) => {
    if (config.url.includes('/companies/')) return profile('company-1')
    attempts += 1
    if (attempts === 1) throw new ApiError('Jobs unavailable', { status: 503 })
    return list([job('recovered', 'company-1')])
  }
  const mounted = await mount(CompanyProfile, { companyId: 'company-1' })
  assert.match(mounted.container.textContent, /Profile company-1/)
  assert.ok(mounted.container.querySelector('[role="alert"]'))
  assert.match(mounted.container.querySelector('[role="alert"]').textContent, /Jobs unavailable/)
  const retry = [...mounted.container.querySelectorAll('button')].find((button) => button.textContent.includes('Thử lại'))
  await click(retry)
  assert.match(mounted.container.textContent, /Job recovered/)
  assert.equal(requests.filter((request) => request.url.includes('/companies/')).length, 1)
  assert.equal(requests.filter((request) => request.url === '/job-discovery/jobs').length, 2)
  await mounted.unmount()
})

test('pagination stays scoped to Jobs and resets on companyId change without old results', async () => {
  requests.length = 0
  const nextCompany = deferred()
  const oldPage = deferred()
  respond = (config) => {
    if (config.url === '/job-discovery/companies/company-1') return profile('company-1')
    if (config.url === '/job-discovery/companies/company-2') return nextCompany.promise
    if (config.params.companyId === 'company-2') return list([job('new', 'company-2')])
    if (config.params.page === 3) return oldPage.promise
    if (config.params.page === 2) return list([job('page-two', 'company-1')], 2, 21)
    return list([job('old', 'company-1')], 1, 21)
  }
  const mounted = await mount(CompanyProfile, { companyId: 'company-1' })
  assert.match(mounted.container.textContent, /Job old/)
  await click(mounted.container.querySelector('[aria-label="Trang sau"]'))
  assert.equal(requests.at(-1).params.page, 2)
  assert.equal(requests.at(-1).params.companyId, 'company-1')
  assert.match(mounted.container.textContent, /Job page-two/)
  assert.equal(mounted.container.querySelector('[aria-current="page"]').textContent, '2')
  assert.match(mounted.container.textContent, /21 vị trí/)
  assert.equal(requests.filter((request) => request.url.includes('/companies/')).length, 1)

  await click(mounted.container.querySelector('[aria-label="Trang sau"]'))
  assert.equal(requests.at(-1).params.page, 3)

  await mounted.render({ companyId: 'company-2' })
  assert.doesNotMatch(mounted.container.textContent, /Job old/)
  assert.equal(requests.filter((request) => request.url === '/job-discovery/jobs' && request.params.companyId === 'company-2').length, 0)
  await act(async () => nextCompany.resolve(profile('company-2')))
  assert.equal(requests.at(-1).params.page, 1)
  assert.equal(requests.at(-1).params.companyId, 'company-2')
  assert.match(mounted.container.textContent, /Job new/)
  await act(async () => oldPage.resolve(list([job('stale', 'company-1')], 3, 21)))
  assert.doesNotMatch(mounted.container.textContent, /Job stale/)
  await mounted.unmount()
})

test('invalid Company profile never starts the Jobs request', async () => {
  requests.length = 0
  respond = (config) => {
    if (config.url.includes('/companies/')) throw new ApiError('Company unavailable', { status: 404 })
    return list([job('should-not-load', 'company-1')])
  }
  const mounted = await mount(CompanyProfile, { companyId: 'company-1' })
  assert.equal(requests.filter((request) => request.url === '/job-discovery/jobs').length, 0)
  assert.equal(mounted.container.querySelector('#company-jobs-heading'), null)
  assert.match(mounted.container.textContent, /Không xem được công ty/)
  await mounted.unmount()
})

test('Guest and Candidate use the same Company Jobs query', async () => {
  for (const role of [null, 'CANDIDATE']) {
    requests.length = 0
    respond = () => list([job('shared', 'company-1')])
    const mounted = await mount(CompanyJobsSection, { companyId: 'company-1' }, role)
    assert.match(mounted.container.textContent, /Job shared/)
    assert.equal(requests[0].params.companyId, 'company-1')
    assert.equal(requests[0].requiresAuthentication, true)
    await mounted.unmount()
  }
})

test('Homepage and Job Search keep unscoped discovery queries', async () => {
  requests.length = 0
  respond = () => list([job('general', 'company-1')])
  const provinceNameByCode = new Map([['HNI', 'Hà Nội']])
  const hero = await mount(HomeHero, { provinceNameByCode })
  assert.match(hero.container.textContent, /Job general/)
  assert.equal(requests[0].params.companyId, undefined)
  await hero.unmount()

  requests.length = 0
  const search = await mount(JobSearchResults, {
    search: parseJobSearch(new URLSearchParams()), filtered: false, provinceNameByCode,
    onSortChange: () => {}, onPageChange: () => {}, onReset: () => {},
  })
  assert.match(search.container.textContent, /Job general/)
  assert.equal(requests[0].params.companyId, undefined)
  await search.unmount()
})
