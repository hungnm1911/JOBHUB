import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { Editor } from '@tiptap/core'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true,
})
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  globalThis[name] = name === 'window' ? dom.window : dom.window[name]
}
globalThis.getSelection = dom.window.getSelection.bind(dom.window)
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
dom.window.HTMLElement.prototype.attachEvent = () => {}
dom.window.HTMLElement.prototype.detachEvent = () => {}
dom.window.Range.prototype.getClientRects = () => ({ length: 0, item: () => null })
dom.window.Range.prototype.getBoundingClientRect = () => ({ top: 0, right: 0, bottom: 0, left: 0 })
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement, useState } = await import('react')
const { createRoot } = await import('react-dom/client')
const editors = []
const originalEmit = Editor.prototype.emit
Editor.prototype.emit = function (event, ...args) {
  if (event === 'beforeCreate') editors.push(this)
  return originalEmit.call(this, event, ...args)
}
const vite = await createServer({ appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } })
const { default: CvGeneratedContentFields } = await vite.ssrLoadModule('/src/features/candidate-cvs/components/CvGeneratedContentFields.jsx')
const { emptyGeneratedContent, toContentPayload } = await vite.ssrLoadModule('/src/features/candidate-profile/utils.js')

after(async () => {
  Editor.prototype.emit = originalEmit
  await vite.close()
  dom.window.close()
})

test('Generated CV create/edit fields preserve and submit Minimal HTML with matching plain text', async () => {
  const initial = {
    ...emptyGeneratedContent(),
    professionalSummary: 'Legacy <summary>',
    workExperiences: [{ position: 'Engineer', description: 'Existing work', descriptionHtml: '<p><strong>Existing</strong> work</p>', achievements: [] }],
    projects: [{ name: 'Project', description: 'Existing project', descriptionHtml: '<p><em>Existing</em> project</p>', technologies: [] }],
  }
  let content = initial
  function Harness() {
    const [value, setValue] = useState(initial)
    content = value
    return createElement(CvGeneratedContentFields, { content: value, onChange: setValue })
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(createElement(Harness)))
    assert.equal(container.querySelectorAll('.rich-text-editor').length, 3)
    assert.equal(container.querySelectorAll('textarea').length, 1) // achievements remain plain strings
    assert.equal(editors.length, 3)
    assert.equal(editors[0].schema.nodes.heading, undefined)
    assert.equal(editors[0].getHTML(), '<p>Legacy &lt;summary&gt;</p>')
    assert.equal(editors[1].getHTML(), '<p><strong>Existing</strong> work</p>')
    assert.equal(editors[2].getHTML(), '<p><em>Existing</em> project</p>')
    assert.equal(toContentPayload(content).workExperiences[0].descriptionHtml, initial.workExperiences[0].descriptionHtml)

    await act(async () => editors[0].commands.setContent('<p><strong>New</strong> summary</p>'))
    await act(async () => editors[1].commands.setContent('<p><em>New</em> work</p>'))
    await act(async () => editors[2].commands.setContent('<p><strong>New</strong> project</p>'))
    const payload = toContentPayload(content)
    assert.equal(payload.professionalSummary, 'New summary')
    assert.equal(payload.professionalSummaryHtml, '<p><strong>New</strong> summary</p>')
    assert.equal(payload.workExperiences[0].description, 'New work')
    assert.equal(payload.workExperiences[0].descriptionHtml, '<p><em>New</em> work</p>')
    assert.equal(payload.projects[0].description, 'New project')
    assert.equal(payload.projects[0].descriptionHtml, '<p><strong>New</strong> project</p>')

    await act(async () => editors[1].commands.clearContent())
    assert.equal(content.workExperiences[0].description, null)
    assert.equal(content.workExperiences[0].descriptionHtml, null)
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})
