import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { Editor } from '@tiptap/core'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true,
})
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver', 'DocumentFragment', 'CustomEvent', 'localStorage']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? dom.window : dom.window[name] })
}
globalThis.getSelection = dom.window.getSelection.bind(dom.window)
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
dom.window.HTMLElement.prototype.attachEvent = () => {}
dom.window.HTMLElement.prototype.detachEvent = () => {}
dom.window.Range.prototype.getClientRects = () => ({ length: 0, item: () => null })
dom.window.Range.prototype.getBoundingClientRect = () => ({ top: 0, right: 0, bottom: 0, left: 0 })
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { act, createElement, useState } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createMemoryRouter, RouterProvider } = await import('react-router-dom')
const editors = []
const originalEmit = Editor.prototype.emit
Editor.prototype.emit = function (event, ...args) {
  if (event === 'beforeCreate') editors.push(this)
  return originalEmit.call(this, event, ...args)
}
const vite = await createServer({ appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } })
const { default: apiClient } = await vite.ssrLoadModule('/src/apis/client/index.js')
const { default: CvMetadataFields } = await vite.ssrLoadModule('/src/features/candidate-cvs/components/CvMetadataFields.jsx')
const { default: CvCreateDraftForm } = await vite.ssrLoadModule('/src/features/candidate-cvs/components/CvCreateDraftForm.jsx')
const { default: CandidateCvCreate } = await vite.ssrLoadModule('/src/features/candidate-cvs/components/CandidateCvCreate.jsx')
const { default: CvEditMetadataModal } = await vite.ssrLoadModule('/src/features/candidate-cvs/components/CvEditMetadataModal.jsx')
const { default: UnsavedChangesProvider } = await vite.ssrLoadModule('/src/components/common/UnsavedChangesProvider.jsx')
const { emptyGeneratedContent, toContentPayload } = await vite.ssrLoadModule('/src/features/candidate-profile/utils.js')

const fields = [{ id: 'field-1', name: 'Engineering' }, { id: 'field-2', name: 'Design' }]
const positions = [{ id: 'position-1', name: 'Frontend Engineer', parentCategoryId: 'field-1' }]
const experienceLevels = [{ id: 'experience-1', code: 'UNDER_1_YEAR' }]
let detailError = false
let savedCv
const writes = []
apiClient.defaults.adapter = async (config) => {
  if (config.method === 'get') {
    if (detailError && config.url === '/candidate/cvs/cv-1') throw new Error('Detail unavailable')
    const data = {
      '/categories/fields': { fields },
      '/categories/fields/field-1/positions': { positions },
      '/categories/fields/field-2/positions': { positions: [] },
      '/experience-levels': { experienceLevels },
      '/locations/provinces': { provinces: [] },
      '/candidate/profile': { profile: null },
      '/candidate/cvs/cv-1': { cv: savedCv },
    }[config.url]
    assert.ok(data, `Unexpected GET ${config.url}`)
    return { data, status: 200, headers: {}, config }
  }
  const payload = JSON.parse(config.data)
  writes.push({ method: config.method, url: config.url, payload })
  savedCv = config.url.endsWith('/generated-content')
    ? { ...savedCv, generatedContent: payload }
    : { ...savedCv, ...payload }
  return { data: { cv: savedCv }, status: 200, headers: {}, config }
}

after(async () => {
  Editor.prototype.emit = originalEmit
  await vite.close()
  dom.window.close()
})

async function mount(Component, props) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const router = createMemoryRouter([
    { path: '/', element: createElement(UnsavedChangesProvider, null, createElement(Component, props)) },
    { path: '/candidate/cvs', element: createElement('p', null, 'CV library') },
  ])
  await act(async () => root.render(createElement(RouterProvider, { router })))
  return { container, router, async unmount() {
    await act(async () => root.unmount())
    router.dispose()
    container.remove()
  } }
}
async function click(button) {
  assert.ok(button, 'Expected button')
  await act(async () => button.dispatchEvent(new window.MouseEvent('click', { bubbles: true })))
}
function button(container, text) {
  return [...container.querySelectorAll('button')].find((item) => item.textContent.includes(text))
}
async function input(element, value) {
  assert.ok(element, 'Expected input')
  await act(async () => {
    const prototype = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
    element.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}
async function select(container, id, label) {
  await click(container.querySelector(`#${id}`))
  await click([...container.querySelectorAll('[role="option"]')].find((option) => option.textContent.includes(label)))
}

test('restores a saved POSITION and experience after the metadata form remounts', async () => {
  let latest
  function Harness() {
    const [values, setValues] = useState({ categoryId: 'position-1', experienceLevelId: 'experience-1' })
    latest = values
    return createElement(CvMetadataFields, { idPrefix: 'test', fields, experienceLevels, values, onChange: setValues })
  }
  for (let index = 0; index < 2; index += 1) {
    const view = await mount(Harness)
    try {
      assert.match(view.container.querySelector('#test-field').textContent, /Engineering/)
      assert.match(view.container.querySelector('#test-position').textContent, /Frontend Engineer/)
      assert.match(view.container.querySelector('#test-experience').textContent, /Dưới 1 năm/)
      await select(view.container, 'test-position', 'Toàn ngành')
      assert.equal(latest.categoryId, 'field-1')
      assert.equal(latest.experienceLevelId, 'experience-1')
      await select(view.container, 'test-field', 'Design')
      assert.equal(latest.categoryId, 'field-2')
    } finally { await view.unmount() }
  }
})

test('create submits all four extended sections, preserves them across tabs and edit save', async () => {
  detailError = false
  writes.length = 0
  savedCv = { id: 'cv-1', sourceType: 'GENERATED', status: 'DRAFT' }
  const view = await mount(CvCreateDraftForm, { onCreated: () => {} })
  try {
    await input(view.container.querySelector('input[placeholder="VD: CV Frontend Engineer 2026"]'), 'Regression CV')
    await select(view.container, 'create-field', 'Engineering')
    await select(view.container, 'create-position', 'Frontend Engineer')
    await select(view.container, 'create-experience', 'Dưới 1 năm')
    await click(button(view.container, '2. Nội dung CV'))
    await click(button(view.container, 'Thêm kinh nghiệm'))
    await input(view.container.querySelector('input[placeholder="Frontend Developer"]'), 'Frontend Intern')
    await act(async () => editors.at(-1).commands.setContent('<p>Built interfaces</p>'))
    const achievements = view.container.querySelector('textarea[placeholder="Giảm 30% thời gian tải trang..."]')
    await input(achievements, 'Shipped feature')
    await input(achievements, `${achievements.value}\n`)
    assert.equal(achievements.value, 'Shipped feature\n')
    await input(achievements, `${achievements.value}Improved performance\n`)
    await click(button(view.container, 'Thêm dự án'))
    await input(view.container.querySelector('input[placeholder="JOBHUB"]'), 'Project marker')
    await act(async () => editors.at(-1).commands.setContent('<p>Project description</p>'))
    const technologies = view.container.querySelector('input[placeholder="React, Node.js, MongoDB"]')
    await input(technologies, 'React')
    await input(technologies, `${technologies.value},`)
    assert.equal(technologies.value, 'React,')
    await input(technologies, `${technologies.value} SQL,`)
    await click(button(view.container, 'Thêm chứng chỉ'))
    await input(view.container.querySelector('input[placeholder="AWS Certified..."]'), 'IELTS')
    await click(button(view.container, 'Thêm ngoại ngữ'))
    await input(view.container.querySelector('input[placeholder="Tiếng Anh, Tiếng Nhật..."]'), 'English')
    await click(button(view.container, '1. Phân loại'))
    await click(button(view.container, '2. Nội dung CV'))
    await act(async () => view.container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(writes.length, 1)
    const payload = writes[0].payload
    assert.equal(payload.categoryId, 'position-1')
    assert.equal(payload.experienceLevelId, 'experience-1')
    assert.equal(payload.generatedContent.workExperiences[0].description, 'Built interfaces')
    assert.equal(payload.generatedContent.workExperiences[0].descriptionHtml, '<p>Built interfaces</p>')
    assert.deepEqual(payload.generatedContent.workExperiences[0].achievements, ['Shipped feature', 'Improved performance'])
    assert.equal(payload.generatedContent.workExperiences[0].startDate, null)
    assert.equal(payload.generatedContent.workExperiences[0].endDate, null)
    assert.equal(payload.generatedContent.projects[0].description, 'Project description')
    assert.equal(payload.generatedContent.projects[0].descriptionHtml, '<p>Project description</p>')
    assert.deepEqual(payload.generatedContent.projects[0].technologies, ['React', 'SQL'])
    assert.equal(payload.generatedContent.certifications[0].name, 'IELTS')
    assert.equal(payload.generatedContent.certifications[0].issueDate, null)
    assert.equal(payload.generatedContent.certifications[0].expirationDate, null)
    assert.equal(payload.generatedContent.languages[0].name, 'English')
    assert.deepEqual(payload.generatedContent.hiddenSections, [])
  } finally { await view.unmount() }
  const { generatedContent: originalContent, ...summary } = savedCv
  const edit = await mount(CvEditMetadataModal, { cv: summary, onClose: () => {}, onUpdated: () => {} })
  try {
    await act(async () => edit.container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.deepEqual(writes.at(-1).payload, originalContent)
    assert.equal(savedCv.categoryId, 'position-1')
    assert.equal(savedCv.experienceLevelId, 'experience-1')
  } finally { await edit.unmount() }
})

test('failed detail load cannot overwrite saved content with an empty form; retry restores data', async () => {
  detailError = true
  writes.length = 0
  savedCv = { id: 'cv-1', name: 'Existing CV', sourceType: 'GENERATED', categoryId: 'field-1', generatedContent: { ...emptyGeneratedContent(), projects: [{ name: 'Keep project' }] } }
  const { generatedContent: originalContent, ...summary } = savedCv
  const view = await mount(CvEditMetadataModal, { cv: summary, onClose: () => {}, onUpdated: () => {} })
  try {
    assert.equal(button(view.container, 'Lưu thay đổi').disabled, true)
    await act(async () => view.container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(writes.length, 0)
    detailError = false
    await click(button(view.container, 'Thử lại'))
    assert.equal(button(view.container, 'Lưu thay đổi').disabled, false)
    await act(async () => view.container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
    assert.deepEqual(savedCv.generatedContent, toContentPayload(originalContent))
  } finally { detailError = false; await view.unmount() }
})

test('create CV warns before changing method or leaving by the back icon', async () => {
  detailError = false
  const view = await mount(CandidateCvCreate)
  try {
    await input(view.container.querySelector('#create-page-name'), 'CV chưa lưu')
    await click(button(view.container, 'Tải lên PDF'))
    assert.ok(document.querySelector('[role="alertdialog"]'))
    assert.ok(view.container.querySelector('#create-page-name'))
    await click(button(document, 'Ở lại'))
    assert.equal(view.container.querySelector('#create-page-name').value, 'CV chưa lưu')

    await click(button(view.container, 'Tải lên PDF'))
    await click(button(document, 'Rời đi'))
    assert.ok(view.container.querySelector('#upload-page-name'))

    await input(view.container.querySelector('#upload-page-name'), 'PDF chưa lưu')
    const back = view.container.querySelector('a[aria-label="Quay lại quản lý CV"]')
    await act(async () => back.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })))
    assert.equal(view.router.state.location.pathname, '/')
    assert.ok(document.querySelector('[role="alertdialog"]'))
    await click(button(document, 'Rời đi'))
    assert.equal(view.router.state.location.pathname, '/candidate/cvs')
  } finally { await view.unmount() }
})

test('edit CV warns on Cancel after a change and keeps the form on Stay', async () => {
  detailError = false
  savedCv = { id: 'cv-1', name: 'Existing CV', sourceType: 'UPLOADED', categoryId: 'field-1' }
  let closed = 0
  const view = await mount(CvEditMetadataModal, {
    cv: savedCv,
    onClose: () => { closed += 1 },
    onUpdated: () => {},
  })
  try {
    await input(view.container.querySelector('#edit-name'), 'Edited CV')
    await click(button(view.container, 'Hủy'))
    assert.equal(closed, 0)
    assert.ok(document.querySelector('[role="alertdialog"]'))
    await click(button(document, 'Ở lại'))
    assert.equal(view.container.querySelector('#edit-name').value, 'Edited CV')
    await click(button(view.container, 'Hủy'))
    await click(button(document, 'Rời đi'))
    assert.equal(closed, 1)
  } finally { await view.unmount() }
})
