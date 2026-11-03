import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  globalThis[name] = name === 'window' ? dom.window : dom.window[name]
}
globalThis.getSelection = dom.window.getSelection.bind(dom.window)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { act, createElement } = await import('react')
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router-dom')
const { Provider } = await import('react-redux')
const vite = await createServer({ appType: 'custom', server: { middlewareMode: true } })
const { default: apiClient } = await vite.ssrLoadModule('/src/apis/client/index.js')
const { default: JobDetail } = await vite.ssrLoadModule('/src/features/job-discovery/components/JobDetail.jsx')
const { store } = await vite.ssrLoadModule('/src/store/store.js')

const originalAdapter = apiClient.defaults.adapter
const requests = []
let job
apiClient.defaults.adapter = async (config) => {
  requests.push([config.method, config.url])
  const data = {
    '/job-discovery/jobs/job-1': { job },
    '/categories/fields': { fields: [] },
    '/locations/provinces': { provinces: [] },
  }[config.url]
  assert.ok(data, `Unexpected request ${config.method} ${config.url}`)
  return { data, status: 200, statusText: 'OK', headers: {}, config }
}

after(async () => {
  apiClient.defaults.adapter = originalAdapter
  await vite.close()
  dom.window.close()
})

const baseJob = {
  id: 'job-1',
  title: 'Role',
  company: { id: 'company-1', name: 'Company' },
  fieldCategories: [],
  positionCategories: [],
  workModes: [],
  location: {},
  jobDescription: 'Plain description',
}

async function mountJob() {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(createElement(Provider, { store },
    createElement(MemoryRouter, null, createElement(JobDetail, { jobId: 'job-1' })))))
  await act(async () => {})
  return {
    container,
    async unmount() {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

test('Job detail consumes V17 HTML safely through the existing detail response', async () => {
  requests.length = 0
  job = {
    ...baseJob,
    jobDescriptionHtml: '<h2>Formatted role</h2><p><strong>Rich description</strong> <a href="javascript:alert(1)">unsafe link</a><script>alert(1)</script></p>',
  }
  const mounted = await mountJob()
  const viewer = mounted.container.querySelector('#job-description-heading + .rich-text-viewer')
  assert.equal(viewer.querySelector('h2').textContent, 'Formatted role')
  assert.equal(viewer.querySelector('strong').textContent, 'Rich description')
  assert.equal(viewer.querySelector('script'), null)
  assert.equal(viewer.querySelector('a').hasAttribute('href'), false)
  assert.equal(viewer.textContent.includes(baseJob.jobDescription), false)
  assert.ok(requests.some(([method, url]) => method === 'get' && url === '/job-discovery/jobs/job-1'))
  await mounted.unmount()
})

test('Job detail accepts pre-V17 and null-HTML responses as escaped plain text', async () => {
  for (const legacy of [
    { ...baseJob, jobDescription: '<b>Legacy</b>\nSecond line' },
    { ...baseJob, jobDescriptionHtml: null, jobDescription: '<b>Legacy</b>\nSecond line' },
  ]) {
    job = legacy
    const mounted = await mountJob()
    const viewer = mounted.container.querySelector('#job-description-heading + .rich-text-viewer')
    assert.equal(viewer.querySelector('b'), null)
    assert.equal(viewer.textContent, '<b>Legacy</b>\nSecond line')
    assert.equal(viewer.classList.contains('whitespace-pre-wrap'), true)
    await mounted.unmount()
  }
})
