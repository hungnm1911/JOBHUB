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
  // ProfileModal portals to <body>, so query the whole body.
  const host = document.createElement('div')
  document.body.append(host)
  const container = document.body
  const root = createRoot(host)
  await act(async () => root.render(createElement(OptimizationDiffModal, props)))
  return { container, unmount: () => act(async () => { root.unmount(); host.remove() }) }
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

test('diff table is not forced wider than the modal and long interleaved text stays fully in the DOM', async () => {
  const token = 'superlongunbreakabletoken'.repeat(6)
  const before = 'Frontend engineer có kinh nghiệm với React, TypeScript và hệ thống tuyển dụng SaaS, đồng thời có kỹ năng Node.js .'
  const after = `Kỹ sư Frontend có kinh nghiệm xây dựng dashboard và hệ thống tuyển dụng SaaS. Có kỹ năng Node.js, ${token} cùng kinh nghiệm với React và TypeScript.`
  const view = await render({ baseline: { professionalSummary: before }, proposedContent: { professionalSummary: after }, onClose() {} })
  const section = view.container.querySelector('[data-section="professionalSummary"]')
  const table = section.querySelector('table')
  // Library default is min-width: 1000px, which overflowed the modal body and clipped the right column.
  assert.notEqual(dom.window.getComputedStyle(table).minWidth, '1000px')
  assert.equal(dom.window.getComputedStyle(table).tableLayout, 'fixed')
  assert.equal(section.querySelector('.overflow-x-hidden'), null)
  assert.ok(section.textContent.includes(token))
  assert.ok(section.textContent.includes('cùng kinh nghiệm với React và TypeScript.'))
  assert.ok(section.querySelectorAll('ins, del').length >= 2, 'word-level highlights present')
  await view.unmount()
})

test('long content scrolls in the modal body, wraps lines, and locks background scroll', async () => {
  const long = Array.from({ length: 300 }, (_, i) => `Line ${i}`).join('\n')
  document.body.style.overflow = 'auto'
  const view = await render({
    baseline: { professionalSummary: long },
    proposedContent: { professionalSummary: `${long}\nExtra` },
    onClose() {},
  })
  const section = view.container.querySelector('[data-section="professionalSummary"]')
  assert.match(section.textContent, /Extra/)
  assert.equal(section.querySelector('.overflow-auto'), null)
  assert.ok(view.container.querySelector('[role="dialog"] .overflow-y-auto'))
  assert.equal(document.body.style.overflow, 'hidden')
  // Portaled to <body> so ancestor stacking contexts (navbar/workspace) cannot cover it.
  assert.equal(document.querySelector('[role="dialog"]').closest('[class*="fixed"]').parentElement, document.body)
  assert.match(view.container.querySelector('[role="dialog"]').className, /max-h-\[calc\(100dvh-2rem\)\]/)
  const labels = [...view.container.querySelectorAll('[role="dialog"] button')].map((b) => b.textContent)
  assert.ok(labels.includes('Đóng'))
  await view.unmount()
  assert.equal(document.body.style.overflow, 'auto')
})
