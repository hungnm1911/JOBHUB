import assert from 'node:assert/strict'
import process from 'node:process'
import { after, test } from 'node:test'

import { Editor } from '@tiptap/core'
import { JSDOM } from 'jsdom'
import { build, createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true })
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
const { act, createElement } = await import('react')
const { createRoot } = await import('react-dom/client')

const editors = []
const originalEmit = Editor.prototype.emit
Editor.prototype.emit = function (event, ...args) {
  if (event === 'beforeCreate') editors.push(this)
  return originalEmit.call(this, event, ...args)
}

const vite = await createServer({ appType: 'custom', server: { middlewareMode: true } })
const { default: RichTextPreviewPage } = await vite.ssrLoadModule('/src/pages/RichTextPreviewPage.jsx')

after(async () => {
  Editor.prototype.emit = originalEmit
  await vite.close()
  dom.window.close()
})

test('standalone preview connects editor HTML to safe viewer across presets and reset', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(createElement(RichTextPreviewPage)))
  try {
    const output = () => container.querySelector('[data-testid="rich-text-html-output"]')
    const viewer = () => container.querySelector('[data-testid="rich-text-preview-viewer"]')
    assert.equal(output().textContent, '(chuỗi rỗng)')

    await act(async () => editors.at(-1).commands.insertContent('<h2>Job heading</h2><p><strong>Bold</strong> <mark>Highlight</mark></p>'))
    assert.match(output().textContent, /<h2>Job heading<\/h2>/)
    assert.equal(viewer().querySelector('h2').textContent, 'Job heading')
    assert.equal(viewer().querySelector('mark').textContent, 'Highlight')

    await act(async () => container.querySelector('button[aria-pressed="false"]').click())
    assert.equal(output().textContent, '(chuỗi rỗng)')
    assert.equal(container.querySelector('[aria-label="Tiêu đề 1"]'), null)
    assert.equal(container.querySelector('[aria-label="Tô sáng"]'), null)
    await act(async () => editors.at(-1).commands.insertContent('<p><strong>CV bold</strong></p>'))
    assert.equal(viewer().querySelector('strong').textContent, 'CV bold')

    await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Thử HTML nguy hiểm').click())
    assert.equal(viewer().querySelector('script, [onclick], [style*="position"]'), null)
    assert.equal(viewer().querySelector('h2, mark'), null)
    assert.equal(viewer().querySelector('a').hasAttribute('href'), false)
    assert.equal(viewer().querySelector('strong').textContent, 'đậm')

    const externalHtml = container.querySelector('#rich-text-external-value').value
    await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Nạp HTML vào Editor').click())
    assert.doesNotMatch(editors.at(-1).getHTML(), /<h2|<mark|<script|onclick=|javascript:/i)
    assert.equal(container.querySelector('[data-testid="rich-text-loaded-html"]').textContent, externalHtml)
    assert.equal(output().textContent, editors.at(-1).getHTML())
    assert.notEqual(output().textContent, externalHtml)
    await act(async () => editors.at(-1).commands.insertContent(' Đã sửa'))
    assert.doesNotMatch(output().textContent, /<h2|<mark|<script|onclick=|javascript:/i)
    assert.equal(viewer().querySelector('strong').textContent, 'đậm')

    await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Thử plain text cũ').click())
    assert.equal(viewer().querySelector('strong'), null)
    assert.match(viewer().textContent, /<strong>thẻ HTML<\/strong>/)

    await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Xóa nội dung').click())
    assert.equal(output().textContent, '(chuỗi rỗng)')
    assert.equal(viewer().textContent, 'Chưa có nội dung.')
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})

test('preview route is lazy in development and absent from production routes', async () => {
  const { default: publicRoutes } = await vite.ssrLoadModule('/src/routes/public.routes.jsx')
  const previewRoute = publicRoutes.find((route) => route.path === 'rich-text-preview')
  assert.ok(previewRoute)
  assert.equal(previewRoute.element, undefined)
  assert.equal(typeof previewRoute.lazy, 'function')
  assert.equal((await previewRoute.lazy()).Component, RichTextPreviewPage)

  const previousNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  let built
  try {
    built = await build({ build: { write: false }, logLevel: 'silent' })
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnv
  }
  const files = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output)
  const entry = files.find((file) => file.type === 'chunk' && file.isEntry)
  assert.ok(entry)
  assert.doesNotMatch(entry.code, /rich-text-preview|RichTextPreviewPage/)
})
