import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  globalThis[name] = name === 'window' ? dom.window : dom.window[name]
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement, Fragment } = await import('react')
const { createRoot } = await import('react-dom/client')
const { Provider } = await import('react-redux')
const { MemoryRouter, useLocation } = await import('react-router-dom')
const vite = await createServer({ appType: 'custom', server: { middlewareMode: true } })
const { default: apiClient } = await vite.ssrLoadModule('/src/apis/client/index.js')
const { store } = await vite.ssrLoadModule('/src/store/store.js')
const { default: HomePage } = await vite.ssrLoadModule('/src/pages/HomePage.jsx')
const originalGet = apiClient.get

after(async () => {
  apiClient.get = originalGet
  await vite.close()
  dom.window.close()
})

const jobs = Array.from({ length: 6 }, (_, index) => ({
  id: `job-${index + 1}`,
  title: `Job ${index + 1}`,
  company: { id: 'company-1', name: 'Company' },
  fieldCategories: [],
  positionCategories: [],
  workModes: [],
}))

function CurrentPath() {
  return createElement('output', { 'data-current-path': true }, useLocation().pathname)
}

async function click(element) {
  assert.ok(element)
  await act(async () => element.dispatchEvent(new window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  })))
}

async function mount(path) {
  const requests = []
  apiClient.get = async (url, options = {}) => {
    requests.push({ url, params: options.params })
    if (url === '/categories/fields') return { data: { fields: [] } }
    if (url === '/locations/provinces') return { data: { provinces: [] } }
    if (url === '/job-discovery/jobs') {
      const featured = options.params.sort === 'FEATURED'
      const limit = options.params.limit
      const total = featured ? 18 : 24
      return { data: {
        jobs: jobs.slice(0, limit),
        pagination: { page: options.params.page ?? 1, limit, total, totalPages: Math.ceil(total / limit) },
        sort: featured ? 'FEATURED' : options.params.keyword ? 'RELEVANCE' : 'NEWEST',
      } }
    }
    throw new Error(`Unexpected request: ${url}`)
  }

  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(createElement(
    Provider,
    { store },
    createElement(MemoryRouter, { initialEntries: [path] }, createElement(
      Fragment,
      null,
      createElement(HomePage),
      createElement(CurrentPath),
    )),
  )))

  return {
    container,
    requests,
    path: () => container.querySelector('[data-current-path]').textContent,
    async unmount() {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

test('both newest-job previews open their Job detail from the whole item', async () => {
  const view = await mount('/')
  const previews = [...view.container.querySelectorAll('ul[aria-label="Việc làm mới đăng"] > li')]
  assert.equal(previews.length, 2)
  assert.equal(previews[0].querySelector('a[href="/jobs/job-1"]')?.parentElement, previews[0])
  assert.equal(previews[1].querySelector('a[href="/jobs/job-2"]')?.parentElement, previews[1])
  await click(previews[0].querySelector('a'))
  assert.equal(view.path(), '/jobs/job-1')
  await click(previews[1].querySelector('span'))
  assert.equal(view.path(), '/jobs/job-2')
  await view.unmount()
})

test('default homepage requests six Featured jobs per page and links to default /jobs', async () => {
  const view = await mount('/?page=2')
  const list = view.requests.find((request) => request.params?.limit === 6)
  assert.equal(list.params.sort, 'FEATURED')
  assert.equal(list.params.page, 2)
  assert.equal(view.container.querySelector('#jobs-heading').textContent, 'Việc làm nổi bật')
  assert.equal(view.container.querySelectorAll('#jobs article').length, 6)
  assert.deepEqual([...view.container.querySelectorAll('#jobs nav button')]
    .filter((button) => /^\d+$/.test(button.textContent))
    .map((button) => button.textContent), ['1', '2', '3'])
  assert.equal(view.container.querySelector('#jobs a[href="/jobs"]').textContent.trim(), 'Xem tất cả')
  assert.equal(view.container.querySelector('#jobs').textContent.includes('Hiển thị'), false)
  assert.equal(view.requests.some((request) => /\/jobs\/[^/]+$/.test(request.url)), false)
  await view.unmount()
})

for (const path of ['/?q=engineer', '/?locations=01', '/?field=field-1']) {
  test(`${path} keeps discovery default sort and unrestricted pagination`, async () => {
    const view = await mount(path)
    const list = view.requests.find((request) => request.params?.limit === 6)
    assert.equal(list.params.sort, undefined)
    assert.equal(view.container.querySelector('#jobs-heading').textContent, 'Kết quả tìm kiếm')
    assert.ok([...view.container.querySelectorAll('#jobs nav button')]
      .some((button) => button.textContent === '4'))
    await view.unmount()
  })
}
