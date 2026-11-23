import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'

import { AxiosError } from 'axios'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true,
})
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver', 'DocumentFragment', 'CustomEvent', 'localStorage']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] })
}
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement } = await import('react')
const { createRoot } = await import('react-dom/client')
const { Provider } = await import('react-redux')
const { MemoryRouter } = await import('react-router-dom')
const vite = await createServer({ appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } })
const { default: apiClient } = await vite.ssrLoadModule('/src/apis/client/index.js')
const { store } = await vite.ssrLoadModule('/src/store/store.js')
const { default: Workspace } = await vite.ssrLoadModule(
  '/src/features/candidate-cv-optimization/components/CandidateCvOptimizeWorkspace.jsx',
)
const originalAdapter = apiClient.defaults.adapter

after(async () => {
  apiClient.defaults.adapter = originalAdapter
  await vite.close()
  dom.window.close()
})

const FIELDS = ['skills', 'category', 'experience', 'employmentType', 'workMode']
const evaluationResult = {
  jobId: 'job-1', candidateCvId: 'cv-1', matchScore: 50, overallSummary: 'ok',
  fieldReviews: FIELDS.map((criterion) => ({ criterion, score: 50, review: 'r' })),
  cvImprovements: [],
}
const proposal = { payload: { version: 1 }, signature: 'sig' }
const changedPreview = {
  baseline: { professionalSummary: 'Old summary' },
  proposedContent: { professionalSummary: 'New summary' },
  proposal,
}

let calls
let handlers
beforeEach(() => {
  calls = []
  handlers = {
    preview: () => ({ status: 200, data: changedPreview }),
    commit: () => ({ status: 201, data: { cv: { id: 'draft-1', name: 'Draft CV' } } }),
  }
  apiClient.defaults.adapter = async (config) => {
    calls.push(config.url)
    let result
    if (config.url === '/candidate/cvs') {
      result = { status: 200, data: { cvs: [{ id: 'cv-1', name: 'My CV', status: 'ACTIVE', isDefault: true }] } }
    } else if (config.url.includes('/jobs') && config.method === 'get') {
      result = { status: 200, data: { jobs: [
        { id: 'job-1', title: 'Job One', company: { name: 'Acme' } },
        { id: 'job-2', title: 'Job Two', company: { name: 'Beta' } },
      ], pagination: {}, sort: null } }
    } else if (config.url.endsWith('/evaluate-cv')) {
      result = { status: 200, data: { evaluationResult } }
    } else if (config.url.endsWith('/optimize-cv/preview')) {
      result = handlers.preview(config)
    } else if (config.url.endsWith('/optimize-cv/commit')) {
      result = handlers.commit(config)
    } else {
      throw new Error(`Unexpected request ${config.method} ${config.url}`)
    }
    result = await result
    if (result.status >= 400) {
      throw new AxiosError('fail', 'ERR_BAD_REQUEST', config, null, {
        status: result.status, data: {}, headers: {}, config,
      })
    }
    return { headers: {}, config, ...result }
  }
})

const click = (element) => act(async () =>
  element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })))
const button = (container, label) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent.includes(label))
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
const count = (suffix) => calls.filter((url) => url.endsWith(suffix)).length

async function mountToPreview() {
  // ProfileModal portals to <body>, so query the whole body.
  const host = document.createElement('div')
  document.body.append(host)
  const container = document.body
  const root = createRoot(host)
  await act(async () => root.render(createElement(Provider, { store },
    createElement(MemoryRouter, null, createElement(Workspace)))))
  await settle()
  await click(button(container, 'Job One'))
  await click(button(container, 'Phân tích CV'))
  await settle()
  await click(button(container, 'Xem bản tối ưu'))
  await settle()
  return { container, unmount: () => act(async () => { root.unmount(); host.remove() }) }
}

test('Optimize calls only Preview and opens the Diff; Save commits once, never re-optimizes', async () => {
  const { container, unmount } = await mountToPreview()
  assert.equal(count('/optimize-cv/preview'), 1)
  assert.equal(count('/optimize-cv/commit'), 0)
  assert.ok(!calls.some((url) => url.endsWith('/optimize-cv')), 'legacy endpoint unused')
  assert.match(container.querySelector('[data-testid="optimization-diff"]').textContent, /New summary/)
  assert.equal(container.querySelector('textarea'), null)

  await click(button(container, 'Lưu bản nháp'))
  await settle()
  assert.equal(count('/optimize-cv/commit'), 1)
  assert.equal(count('/optimize-cv/preview'), 1)
  assert.equal(container.querySelector('[data-testid="optimization-diff"]'), null)
  assert.match(container.textContent, /Đã lưu bản nháp tối ưu/)
  assert.match(container.textContent, /Draft CV/)
  assert.equal(
    [...container.querySelectorAll('a')].find((a) => a.textContent === 'Quản lý CV').getAttribute('href'),
    '/candidate/cvs',
  )
  await unmount()
})

test('double clicking Save sends one Commit while loading', async () => {
  let release
  handlers.commit = () => new Promise((resolve) => {
    release = () => resolve({ status: 201, data: { cv: { id: 'd', name: 'D' } } })
  })
  const { container, unmount } = await mountToPreview()
  const save = button(container, 'Lưu bản nháp')
  await click(save)
  await click(save)
  assert.equal(count('/optimize-cv/commit'), 1)
  assert.ok(button(container, 'Đang lưu').disabled)
  assert.ok(button(container, 'Hủy').disabled)
  await act(async () => release())
  await settle()
  assert.equal(count('/optimize-cv/commit'), 1)
  await unmount()
})

test('Cancel writes nothing and the Proposal can be reviewed again', async () => {
  const { container, unmount } = await mountToPreview()
  await click(button(container, 'Hủy'))
  assert.equal(count('/optimize-cv/commit'), 0)
  assert.equal(container.querySelector('[data-testid="optimization-diff"]'), null)
  await click(button(container, 'Xem so sánh'))
  assert.ok(container.querySelector('[data-testid="optimization-diff"]'))
  await unmount()
})

test('changing the Job invalidates the old Proposal', async () => {
  const { container, unmount } = await mountToPreview()
  await click(button(container, 'Hủy'))
  assert.ok(button(container, 'Xem so sánh'))
  await click(button(container, 'Job Two'))
  assert.equal(button(container, 'Xem so sánh'), undefined)
  assert.equal(count('/optimize-cv/commit'), 0)
  await unmount()
})

for (const [status, pattern] of [
  [400, /không hợp lệ hoặc đã hết hạn/],
  [403, /không thuộc về bạn/],
  [404, /Không tìm thấy việc làm hoặc CV nguồn/],
  [409, /CV nguồn đã thay đổi/],
]) {
  test(`Commit ${status} closes the Diff, explains, discards the Proposal, no retry`, async () => {
    handlers.commit = () => ({ status })
    const { container, unmount } = await mountToPreview()
    await click(button(container, 'Lưu bản nháp'))
    await settle()
    assert.equal(count('/optimize-cv/commit'), 1)
    assert.equal(container.querySelector('[data-testid="optimization-diff"]'), null)
    assert.match(container.textContent, pattern)
    assert.equal(button(container, 'Xem so sánh'), undefined)
    await unmount()
  })
}

test('Commit 5xx keeps the Diff, reports unknown outcome, never auto-retries', async () => {
  handlers.commit = () => ({ status: 500 })
  const { container, unmount } = await mountToPreview()
  await click(button(container, 'Lưu bản nháp'))
  await settle()
  assert.equal(count('/optimize-cv/commit'), 1)
  const alert = container.querySelector('[data-testid="optimization-commit-error"]')
  assert.match(alert.textContent, /Chưa xác định/)
  assert.match(alert.textContent, /Quản lý CV/)
  assert.ok(button(container, 'Thử lưu lại'))

  handlers.commit = () => ({ status: 201, data: { cv: { id: 'd', name: 'D' } } })
  await click(button(container, 'Thử lưu lại'))
  await settle()
  assert.equal(count('/optimize-cv/commit'), 2)
  assert.match(container.textContent, /Đã lưu bản nháp tối ưu/)
  await unmount()
})

test('a Proposal without changes is shown as such and can still be saved', async () => {
  handlers.preview = () => ({ status: 200, data: {
    baseline: { professionalSummary: 'Same' },
    proposedContent: { professionalSummary: 'Same' },
    proposal,
  } })
  const { container, unmount } = await mountToPreview()
  assert.ok(container.querySelector('[data-testid="optimization-no-changes"]'))
  assert.equal(button(container, 'Lưu bản nháp').disabled, false)
  await click(button(container, 'Lưu bản nháp'))
  await settle()
  assert.equal(count('/optimize-cv/commit'), 1)
  await unmount()
})

test('Unified view labels the sides without a misleading single title', async () => {
  const { container, unmount } = await mountToPreview()
  await click(button(container, 'Gộp'))
  assert.ok(container.querySelector('[data-testid="unified-legend"]'))
  assert.doesNotMatch(
    container.querySelector('[data-section="professionalSummary"]').textContent, /Trước/)
  await unmount()
})
