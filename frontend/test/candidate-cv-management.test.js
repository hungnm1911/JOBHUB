import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true,
})
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver', 'localStorage']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? dom.window : dom.window[name] })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement } = await import('react')
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router-dom')
const vite = await createServer({ appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } })
const { default: apiClient } = await vite.ssrLoadModule('/src/apis/client/index.js')
const { default: CandidateCvManagement } = await vite.ssrLoadModule('/src/features/candidate-cvs/components/CandidateCvManagement.jsx')
const originalGet = apiClient.get
const originalPut = apiClient.put
const originalDelete = apiClient.delete

const cvs = [
  { id: 'default', name: 'CV mặc định', status: 'ACTIVE', sourceType: 'GENERATED', visibility: 'PUBLIC', isDefault: true },
  { id: 'uploaded', name: 'CV PDF', status: 'ACTIVE', sourceType: 'UPLOADED', visibility: 'PRIVATE', isDefault: false },
  { id: 'draft', name: 'CV bản nháp', status: 'DRAFT', sourceType: 'GENERATED', visibility: 'PUBLIC', isDefault: false },
  { id: 'generated', name: 'CV tạo mới', status: 'ACTIVE', sourceType: 'GENERATED', visibility: 'PRIVATE', isDefault: false },
]

after(async () => {
  apiClient.get = originalGet
  apiClient.put = originalPut
  apiClient.delete = originalDelete
  await vite.close()
  dom.window.close()
})

async function click(element) {
  assert.ok(element, 'Expected interactive element')
  await act(async () => element.dispatchEvent(new window.MouseEvent('click', { bubbles: true })))
}

async function mount() {
  apiClient.get = async (url) => {
    assert.equal(url, '/candidate/cvs')
    return { data: { cvs } }
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(createElement(MemoryRouter, null, createElement(CandidateCvManagement))))
  return { container, async unmount() {
    await act(async () => root.unmount())
    container.remove()
  } }
}

test('status and source dropdowns combine, while the default CV has its own section', async () => {
  const view = await mount()
  const { container } = view
  const defaultSection = container.querySelector('section[aria-labelledby="default-cv-heading"]')
  const otherSection = container.querySelector('section[aria-labelledby="other-cvs-heading"]')
  assert.ok(defaultSection)
  assert.equal(defaultSection.querySelectorAll('article').length, 1)
  assert.match(defaultSection.textContent, /CV mặc định/)
  assert.equal(otherSection.querySelectorAll('article').length, 3)

  await click(container.querySelector('button[aria-label="Lọc theo trạng thái"]'))
  await click([...container.querySelectorAll('[role="option"]')].find((option) => option.textContent.includes('Đang dùng')))
  await click(container.querySelector('button[aria-label="Lọc theo loại CV"]'))
  await click([...container.querySelectorAll('[role="option"]')].find((option) => option.textContent.includes('PDF tải lên')))
  assert.deepEqual([...container.querySelectorAll('article')].map((card) => card.textContent.includes('CV PDF')), [true])
  assert.equal(container.querySelector('section[aria-labelledby="default-cv-heading"]'), null)
  assert.equal(container.querySelector('section[aria-labelledby="other-cvs-heading"]')?.querySelectorAll('article').length, 1)

  await click([...container.querySelectorAll('button')].find((button) => button.textContent.includes('Tất cả (4)')))
  assert.equal(container.querySelector('section[aria-labelledby="default-cv-heading"]')?.querySelectorAll('article').length, 1)
  assert.equal(container.querySelector('section[aria-labelledby="other-cvs-heading"]')?.querySelectorAll('article').length, 3)
  await view.unmount()
})

test('changing the default CV moves the item between sections', async () => {
  apiClient.put = async (url) => {
    assert.equal(url, '/candidate/cvs/uploaded/default')
    return { data: { cv: { ...cvs[1], isDefault: true } } }
  }
  apiClient.delete = async (url) => {
    assert.equal(url, '/candidate/cvs/uploaded/default')
    return { data: { cv: { ...cvs[1], isDefault: false } } }
  }
  const view = await mount()
  const { container } = view
  await click(container.querySelector('button[aria-label="Đặt CV PDF làm CV mặc định"]'))
  assert.match(container.querySelector('section[aria-labelledby="default-cv-heading"] article').textContent, /CV PDF/)
  assert.equal(container.querySelector('section[aria-labelledby="other-cvs-heading"]')?.querySelectorAll('article').length, 3)

  await click(container.querySelector('section[aria-labelledby="default-cv-heading"] button[aria-label="Đang là CV mặc định. Nhấn để bỏ đặt mặc định"]'))
  assert.equal(container.querySelector('section[aria-labelledby="default-cv-heading"]'), null)
  assert.equal(container.querySelector('section[aria-labelledby="other-cvs-heading"]')?.querySelectorAll('article').length, 4)
  await view.unmount()
})

test('visibility combines with status and source, and all resets every dropdown', async () => {
  const view = await mount()
  const { container } = view

  await click(container.querySelector('button[aria-label="Lọc theo hiển thị"]'))
  await click([...container.querySelectorAll('[role="option"]')].find((option) => option.textContent.includes('Riêng tư')))
  assert.equal(container.querySelectorAll('article').length, 2)

  await click(container.querySelector('button[aria-label="Lọc theo trạng thái"]'))
  await click([...container.querySelectorAll('[role="option"]')].find((option) => option.textContent.includes('Đang dùng')))
  await click(container.querySelector('button[aria-label="Lọc theo loại CV"]'))
  await click([...container.querySelectorAll('[role="option"]')].find((option) => option.textContent.includes('Tạo trên JOBHUB')))
  assert.equal(container.querySelectorAll('article').length, 1)
  assert.match(container.querySelector('article').textContent, /CV tạo mới/)

  await click([...container.querySelectorAll('button')].find((button) => button.textContent.includes('Tất cả (4)')))
  assert.equal(container.querySelectorAll('article').length, 4)
  await view.unmount()
})
