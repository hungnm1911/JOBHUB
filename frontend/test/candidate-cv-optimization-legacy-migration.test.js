import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { after, beforeEach, test } from 'node:test'

import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

// Static guard: no frontend source may call the legacy POST /optimize-cv.
function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(jsx?|tsx?)$/.test(name) ? [path] : []
  })
}

test('no frontend source references the legacy optimize-cv endpoint', () => {
  const offenders = sourceFiles('src').filter((file) => {
    const text = readFileSync(file, 'utf8')
    return /optimize-cv['"`]/.test(text) ||
      /createOptimizedCandidateCvDraftForJobApi|useCvJobOptimization/.test(text)
  })
  assert.deepEqual(offenders, [])
})

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
const { default: Dialog } = await vite.ssrLoadModule(
  '/src/features/candidate-cv-evaluation/components/JobCvEvaluationDialog.jsx',
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
let calls
beforeEach(() => {
  calls = []
  apiClient.defaults.adapter = async (config) => {
    calls.push(config.url)
    let data
    if (config.url === '/candidate/cvs') {
      data = { cvs: [{ id: 'cv-1', name: 'My CV', status: 'ACTIVE', isDefault: true }] }
    } else if (config.url.endsWith('/evaluate-cv')) {
      data = { evaluationResult }
    } else if (config.url.endsWith('/optimize-cv/preview')) {
      data = {
        baseline: { professionalSummary: 'Old summary' },
        proposedContent: { professionalSummary: 'New summary' },
        proposal,
      }
    } else if (config.url.endsWith('/optimize-cv/commit')) {
      data = { cv: { id: 'draft-1', name: 'Draft CV' } }
    } else {
      throw new Error(`Unexpected request ${config.method} ${config.url}`)
    }
    return { status: 200, headers: {}, config, data }
  }
})

const click = (element) => act(async () =>
  element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })))
const button = (container, label) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent.includes(label))
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
const count = (suffix) => calls.filter((url) => url.endsWith(suffix)).length

test('dialog Optimize = Preview + Diff; Draft only after Save; no legacy call or extra evaluation', async () => {
  // ProfileModal portals to <body>, so query the whole body.
  const host = document.createElement('div')
  document.body.append(host)
  const container = document.body
  const root = createRoot(host)
  await act(async () => root.render(createElement(Provider, { store },
    createElement(MemoryRouter, null,
      createElement(Dialog, { jobId: 'job-1', jobTitle: 'Job One', onClose: () => {} })))))
  await settle()
  await click(button(container, 'Đánh giá CV'))
  await settle()
  assert.equal(count('/evaluate-cv'), 1)

  await click(button(container, 'Tối ưu CV'))
  await settle()
  assert.equal(count('/optimize-cv/preview'), 1)
  assert.equal(count('/optimize-cv/commit'), 0, 'no Draft before Save')
  assert.match(container.querySelector('[data-testid="optimization-diff"]').textContent, /New summary/)

  await click(button(container, 'Hủy'))
  assert.equal(count('/optimize-cv/commit'), 0, 'Cancel writes nothing')
  assert.equal(container.querySelector('[data-testid="optimization-diff"]'), null)

  await click(button(container, 'Tối ưu CV'))
  await settle()
  await click(button(container, 'Lưu bản nháp'))
  await settle()
  assert.equal(count('/optimize-cv/commit'), 1)
  assert.equal(count('/evaluate-cv'), 1, 'no additional evaluation/LLM request')
  assert.ok(!calls.some((url) => url.endsWith('/optimize-cv')), 'legacy endpoint unused')
  assert.match(container.textContent, /Đã tạo bản nháp CV tối ưu/)
  assert.match(container.textContent, /Draft CV/)

  await act(async () => { root.unmount(); host.remove() })
})
