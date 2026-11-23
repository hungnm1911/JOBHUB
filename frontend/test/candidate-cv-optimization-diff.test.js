import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true,
})
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver', 'DocumentFragment', 'CustomEvent']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] })
}
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement } = await import('react')
const { createRoot } = await import('react-dom/client')
const vite = await createServer({ appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } })
const { buildOptimizationDiffSections, CHANGE, DIFF_SECTIONS } = await vite.ssrLoadModule(
  '/src/features/candidate-cv-optimization/diffSections.js',
)
const { default: OptimizationDiffModal } = await vite.ssrLoadModule(
  '/src/features/candidate-cv-optimization/components/OptimizationDiffModal.jsx',
)

after(async () => {
  await vite.close()
  dom.window.close()
})

const baseline = {
  personalInfo: { fullName: 'Ignored Name' },
  professionalSummary: 'Original summary',
  professionalSummaryHtml: '<p>Original summary</p>',
  skills: ['JavaScript', 'SQL'],
  workExperiences: [{
    companyName: 'Acme', position: 'Dev', startDate: '2020-01-01T00:00:00.000Z',
    description: 'Built APIs', achievements: ['Cut latency'],
  }],
  projects: [],
  educations: [{ institutionName: 'Uni', degree: 'BSc', startDate: '2015-09-01T00:00:00.000Z' }],
  certifications: [],
  languages: [{ name: 'English', proficiency: 'B2' }],
}
const proposed = {
  ...baseline,
  professionalSummary: 'Targeted summary',
  skills: ['SQL', 'Node.js'],
  projects: [{ name: 'Portal', technologies: ['React', 'Node.js'], description: 'Built it' }],
  languages: [],
}

test('formats the seven sections as readable text, in order', () => {
  assert.deepEqual(DIFF_SECTIONS.map((s) => s.key), [
    'professionalSummary', 'skills', 'workExperiences', 'projects',
    'educations', 'certifications', 'languages',
  ])
  const sections = buildOptimizationDiffSections(baseline, proposed)
  const by = Object.fromEntries(sections.map((s) => [s.key, s]))
  assert.equal(by.skills.before, '• JavaScript\n• SQL')
  assert.equal(by.skills.after, '• SQL\n• Node.js')
  assert.equal(
    by.workExperiences.before,
    'Dev — Acme\n2020-01-01 → Hiện tại\nBuilt APIs\n• Cut latency',
  )
  assert.equal(by.projects.after, 'Portal\nReact, Node.js\nBuilt it')
  assert.ok(!sections.some((s) => /[{}]|<p>|Ignored Name/.test(s.before + s.after)))
})

test('classifies empty, unchanged, added, removed and modified sections', () => {
  const change = Object.fromEntries(
    buildOptimizationDiffSections(baseline, proposed).map((s) => [s.key, s.change]),
  )
  assert.equal(change.professionalSummary, CHANGE.MODIFIED)
  assert.equal(change.workExperiences, CHANGE.UNCHANGED)
  assert.equal(change.projects, CHANGE.ADDED)
  assert.equal(change.languages, CHANGE.REMOVED)
  assert.equal(change.certifications, CHANGE.EMPTY)
})

test('tolerates missing or malformed content', () => {
  const sections = buildOptimizationDiffSections(undefined, { skills: 'x', projects: [null] })
  assert.ok(sections.every((s) => s.change === CHANGE.EMPTY))
})

async function render(props) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(createElement(OptimizationDiffModal, props)))
  return { container, unmount: () => act(async () => { root.unmount(); container.remove() }) }
}

test('modal shows diff only for changed sections, toggles split view, and is review-only', async () => {
  let closed = 0
  const view = await render({ baseline, proposedContent: proposed, onClose: () => { closed += 1 } })
  const { container } = view
  const sec = (key) => container.querySelector(`[data-section="${key}"]`)

  assert.equal(container.querySelectorAll('[data-section]').length, 7)
  assert.match(sec('professionalSummary').textContent, /Original summary/)
  assert.match(sec('professionalSummary').textContent, /Targeted summary/)
  assert.match(sec('professionalSummary').textContent, /Trước.*Sau/s)
  assert.match(sec('workExperiences').textContent, /Không thay đổi/)
  assert.match(sec('certifications').textContent, /Không có nội dung/)
  assert.equal(sec('certifications').querySelector('table'), null)
  assert.equal(container.querySelector('textarea, input'), null)
  const labels = [...container.querySelectorAll('button')].map((b) => b.textContent)
  assert.ok(!labels.some((l) => /chấp nhận|từ chối|lưu/i.test(l)))

  const [splitButton, unifiedButton] = container.querySelectorAll('[role="group"] button')
  assert.equal(splitButton.getAttribute('aria-pressed'), 'true')
  await act(async () => unifiedButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })))
  assert.equal(unifiedButton.getAttribute('aria-pressed'), 'true')
  assert.doesNotMatch(sec('professionalSummary').textContent, /Sau/)

  const close = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Đóng')
  await act(async () => close.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })))
  assert.equal(closed, 1)
  await view.unmount()
})

test('long content is rendered in a scrollable block', async () => {
  const long = Array.from({ length: 300 }, (_, i) => `Line ${i}`).join('\n')
  const view = await render({
    baseline: { professionalSummary: long },
    proposedContent: { professionalSummary: `${long}\nExtra` },
    onClose() {},
  })
  const block = view.container.querySelector('[data-section="professionalSummary"] .overflow-auto')
  assert.ok(block)
  assert.match(block.textContent, /Extra/)
  await view.unmount()
})
