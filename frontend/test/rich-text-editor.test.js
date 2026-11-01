import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { Editor } from '@tiptap/core'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

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
const { default: RichTextEditor } = await vite.ssrLoadModule('/src/components/common/RichTextEditor.jsx')

after(async () => {
  Editor.prototype.emit = originalEmit
  await vite.close()
  dom.window.close()
})

async function mount(props) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  async function render(nextProps) {
    await act(async () => {
      root.render(createElement(RichTextEditor, nextProps))
    })
  }

  await render(props)
  assert.ok(editors.at(-1), 'Tiptap editor was created')

  return {
    container,
    get editor() { return editors.at(-1) },
    render,
    async unmount() {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

test('full and minimal presets expose only their supported formatting schema', async () => {
  const full = await mount({ value: '<h2>Title</h2>' })
  assert.ok(full.editor.schema.nodes.heading)
  assert.ok(full.editor.schema.nodes.bulletList)
  assert.ok(full.editor.schema.nodes.orderedList)
  assert.ok(full.editor.schema.marks.textStyle)
  assert.ok(full.editor.schema.marks.highlight)
  assert.equal(full.editor.schema.nodes.heading.spec.attrs.level.default, 1)
  assert.equal(full.editor.schema.nodes.codeBlock, undefined)
  assert.equal(full.editor.schema.marks.strike, undefined)
  assert.equal(full.editor.getHTML(), '<h2>Title</h2>')
  const extensionNames = full.editor.extensionManager.extensions.map((extension) => extension.name)
  assert.equal(new Set(extensionNames).size, extensionNames.length)
  await full.unmount()

  const minimal = await mount({ value: '<h2>Title</h2>', preset: 'minimal' })
  assert.equal(minimal.editor.schema.nodes.heading, undefined)
  assert.ok(minimal.editor.schema.nodes.bulletList)
  assert.ok(minimal.editor.schema.nodes.orderedList)
  assert.ok(minimal.editor.schema.marks.bold)
  assert.ok(minimal.editor.schema.marks.italic)
  assert.ok(minimal.editor.schema.marks.underline)
  assert.ok(minimal.editor.schema.marks.link)
  assert.equal(minimal.editor.schema.marks.textStyle, undefined)
  assert.equal(minimal.editor.schema.marks.highlight, undefined)
  assert.equal(minimal.editor.schema.marks.strike, undefined)
  assert.equal(minimal.editor.getHTML(), '<p>Title</p>')
  assert.equal(minimal.container.querySelector('[aria-label="Tiêu đề 1"]'), null)
  assert.equal(minimal.container.querySelector('[aria-label="Căn giữa"]'), null)
  assert.equal(minimal.container.querySelector('[aria-label="Phông chữ"]'), null)
  assert.equal(minimal.container.querySelector('[aria-label="Tô sáng"]'), null)
  await minimal.unmount()
})

async function clickControl(mounted, label) {
  const control = mounted.container.querySelector(`[aria-label="${label}"]`)
  assert.ok(control, `${label} control exists`)
  assert.equal(control.disabled, false, `${label} control is enabled`)
  await act(async () => control.click())
}

test('minimal toolbar formats text, lists and links with available commands', async () => {
  const mounted = await mount({ value: '<p>hello</p>', preset: 'minimal' })
  await act(async () => mounted.editor.commands.setTextSelection({ from: 1, to: 6 }))
  await clickControl(mounted, 'Đậm')
  await clickControl(mounted, 'Nghiêng')
  await clickControl(mounted, 'Gạch chân')
  assert.equal(mounted.editor.getHTML(), '<p><strong><em><u>hello</u></em></strong></p>')

  await clickControl(mounted, 'Chèn hoặc sửa liên kết')
  const input = mounted.container.querySelector('input[type="url"]')
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set
    setter.call(input, 'https://example.com')
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
    input.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  await act(async () => {
    input.closest('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  })
  assert.match(mounted.editor.getHTML(), /href="https:\/\/example\.com"/)
  assert.equal(mounted.container.querySelector('input[type="url"]'), null)
  assert.equal(mounted.container.querySelector('[aria-label="Chèn hoặc sửa liên kết"]').getAttribute('aria-pressed'), 'true')
  await clickControl(mounted, 'Gỡ liên kết')
  assert.doesNotMatch(mounted.editor.getHTML(), /href=/)
  assert.equal(mounted.container.querySelector('[aria-label="Chèn hoặc sửa liên kết"]').getAttribute('aria-pressed'), 'false')

  await clickControl(mounted, 'Danh sách dấu đầu dòng')
  assert.match(mounted.editor.getHTML(), /^<ul>/)
  await clickControl(mounted, 'Danh sách dấu đầu dòng')
  assert.match(mounted.editor.getHTML(), /^<p>/)
  await clickControl(mounted, 'Danh sách đánh số')
  assert.match(mounted.editor.getHTML(), /^<ol>/)
  await clickControl(mounted, 'Hoàn tác')
  assert.match(mounted.editor.getHTML(), /^<p>/)
  await clickControl(mounted, 'Làm lại')
  assert.match(mounted.editor.getHTML(), /^<ol>/)
  await mounted.unmount()
})

test('full toolbar applies heading, alignment, font and highlight formatting', async () => {
  const mounted = await mount({ value: '<p>hello</p>' })
  await act(async () => mounted.editor.commands.setTextSelection({ from: 1, to: 6 }))
  for (const [label, level] of [['Tiêu đề 1', 1], ['Tiêu đề 2', 2], ['Tiêu đề 3', 3]]) {
    await clickControl(mounted, label)
    assert.equal(mounted.editor.isActive('heading', { level }), true)
  }
  for (const [label, value] of [['Căn trái', 'left'], ['Căn phải', 'right'], ['Căn đều', 'justify'], ['Căn giữa', 'center']]) {
    await clickControl(mounted, label)
    assert.equal(mounted.editor.isActive({ textAlign: value }), true)
  }
  await clickControl(mounted, 'Tô sáng')
  assert.match(mounted.editor.getHTML(), /^<h3 style="text-align: center;?"><mark>hello<\/mark><\/h3>$/)

  const family = mounted.container.querySelector('[aria-label="Phông chữ"]')
  const size = mounted.container.querySelector('[aria-label="Cỡ chữ"]')
  const color = mounted.container.querySelector('[aria-label="Màu chữ"]')
  await act(async () => {
    family.value = 'Georgia'
    family.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  await act(async () => {
    size.value = '18px'
    size.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set
    setter.call(color, '#ff0000')
    color.dispatchEvent(new window.Event('change', { bubbles: true }))
    color.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  const html = mounted.editor.getHTML()
  assert.match(html, /font-family: Georgia/)
  assert.match(html, /font-size: 18px/)
  assert.match(html, /color: rgb\(255, 0, 0\)|color: #ff0000/)
  await clickControl(mounted, 'Đặt lại màu chữ')
  assert.doesNotMatch(mounted.editor.getHTML(), /color:/)
  await mounted.unmount()
})

test('color picker reflects an rgb color after HTML reload without changing content or selection', async () => {
  const value = '<p><span style="color: rgb(255, 0, 0)">red</span></p>'
  const mounted = await mount({ value })
  await act(async () => mounted.editor.commands.setTextSelection({ from: 1, to: 4 }))
  const html = mounted.editor.getHTML()
  const selection = mounted.editor.state.selection

  assert.equal(mounted.editor.getAttributes('textStyle').color, 'rgb(255, 0, 0)')
  assert.equal(mounted.container.querySelector('[aria-label="Màu chữ"]').value, '#ff0000')
  assert.ok(mounted.container.querySelector('[aria-label="Đặt lại màu chữ"]'))
  await mounted.render({ value: html })
  assert.equal(mounted.editor.getHTML(), html)
  assert.equal(mounted.editor.state.selection.eq(selection), true)
  assert.equal(mounted.container.querySelector('[aria-label="Màu chữ"]').value, '#ff0000')
  await mounted.unmount()
})

test('rejected link URL keeps the form open with feedback and preserves selection', async () => {
  const mounted = await mount({ value: '<p>hello</p>', preset: 'minimal' })
  await act(async () => mounted.editor.commands.setTextSelection({ from: 1, to: 6 }))
  const selection = mounted.editor.state.selection
  await clickControl(mounted, 'Chèn hoặc sửa liên kết')

  const input = mounted.container.querySelector('input[type="url"]')
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set
    setter.call(input, 'javascript:alert(1)')
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
    input.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  await act(async () => {
    input.closest('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  })

  assert.ok(mounted.container.querySelector('input[type="url"]'))
  assert.match(mounted.container.querySelector('[role="alert"]')?.textContent ?? '', /URL|liên kết/i)
  assert.equal(mounted.editor.getHTML(), '<p>hello</p>')
  assert.equal(mounted.editor.state.selection.eq(selection), true)

  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set
    setter.call(input, 'https://example.com')
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
    input.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  assert.equal(mounted.container.querySelector('[role="alert"]'), null)
  await act(async () => {
    input.closest('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  })
  assert.equal(mounted.container.querySelector('input[type="url"]'), null)
  assert.match(mounted.editor.getHTML(), /href="https:\/\/example\.com"/)
  await mounted.unmount()
})

test('toolbar change echoed by a controlled parent preserves selection', async () => {
  const changes = []
  const props = { value: '<p>hello</p>', preset: 'minimal', onChange: (html) => changes.push(html) }
  const mounted = await mount(props)
  await act(async () => mounted.editor.commands.setTextSelection({ from: 1, to: 6 }))
  await clickControl(mounted, 'Đậm')
  assert.deepEqual(changes, ['<p><strong>hello</strong></p>'])
  const selection = mounted.editor.state.selection
  await mounted.render({ ...props, value: changes[0] })
  assert.equal(mounted.editor.state.selection.eq(selection), true)
  await mounted.unmount()
})

test('disabled toolbar cannot mutate content', async () => {
  const mounted = await mount({ value: '<p>hello</p>', disabled: true })
  assert.equal(mounted.container.querySelector('[aria-label="Đậm"]').disabled, true)
  assert.equal(mounted.container.querySelector('[aria-label="Phông chữ"]').disabled, true)
  assert.equal(mounted.container.querySelector('[aria-label="Chèn hoặc sửa liên kết"]').disabled, true)
  assert.equal(mounted.editor.getHTML(), '<p>hello</p>')
  await mounted.unmount()
})

test('external changes and reset do not emit onChange', async () => {
  const changes = []
  const props = { value: '<p>First</p>', onChange: (html) => changes.push(html) }
  const mounted = await mount(props)

  await mounted.render({ ...props, value: '<p>Second</p>' })
  assert.equal(mounted.editor.getHTML(), '<p>Second</p>')
  await mounted.render({ ...props, value: '' })
  assert.equal(mounted.editor.isEmpty, true)
  await mounted.render({ ...props, value: '<p></p>' })
  assert.equal(mounted.editor.isEmpty, true)
  assert.deepEqual(changes, [])

  await mounted.unmount()
})

test('user edit emits HTML and parent echo preserves the selection', async () => {
  const changes = []
  const props = { value: '<p>abc</p>', onChange: (html) => changes.push(html) }
  const mounted = await mount(props)

  await act(async () => {
    mounted.editor.commands.setTextSelection(3)
    mounted.editor.commands.insertContent('X')
  })
  assert.deepEqual(changes, ['<p>abXc</p>'])
  const selection = mounted.editor.state.selection.from

  await mounted.render({ ...props, value: changes[0] })
  assert.equal(mounted.editor.state.selection.from, selection)
  assert.deepEqual(changes, ['<p>abXc</p>'])

  await mounted.unmount()
})

test('equivalent external HTML preserves selection and clearing emits an empty string', async () => {
  const changes = []
  const props = { value: '<p><strong>abc</strong></p>', onChange: (html) => changes.push(html) }
  const mounted = await mount(props)

  await act(async () => mounted.editor.commands.setTextSelection(3))
  const selection = mounted.editor.state.selection.from
  await mounted.render({ ...props, value: '<p><b>abc</b></p>' })
  assert.equal(mounted.editor.state.selection.from, selection)
  assert.deepEqual(changes, [])

  await act(async () => mounted.editor.commands.clearContent())
  assert.deepEqual(changes, [''])
  await mounted.render({ ...props, value: '<p><br></p>' })
  assert.deepEqual(changes, [''])
  await mounted.unmount()
})

test('empty HTML aliases normalize on mount and external reset without emitting changes', async () => {
  for (const value of ['', '<p></p>', '<p><br></p>']) {
    const changes = []
    const props = { value, onChange: (html) => changes.push(html) }
    const mounted = await mount(props)
    assert.equal(mounted.editor.getHTML(), '<p></p>')
    assert.equal(mounted.editor.isEmpty, true)

    await mounted.render({ ...props, value: '<p>Content</p>' })
    await mounted.render(props)
    assert.equal(mounted.editor.getHTML(), '<p></p>')
    assert.deepEqual(changes, [])
    await mounted.unmount()
  }
})

test('empty heading emits an empty string and parent echo preserves its selection', async () => {
  const changes = []
  const props = { value: '<h2>abc</h2>', onChange: (html) => changes.push(html) }
  const mounted = await mount(props)

  await act(async () => mounted.editor.commands.deleteRange({ from: 1, to: 4 }))
  assert.equal(mounted.editor.getHTML(), '<h2></h2>')
  assert.deepEqual(changes, [''])
  const selection = mounted.editor.state.selection.from

  await mounted.render({ ...props, value: '' })
  assert.equal(mounted.editor.getHTML(), '<h2></h2>')
  assert.equal(mounted.editor.state.selection.from, selection)
  assert.deepEqual(changes, [''])

  await mounted.render({ ...props, value: '<p></p>' })
  assert.equal(mounted.editor.getHTML(), '<p></p>')
  assert.deepEqual(changes, [''])
  await mounted.unmount()
})

test('a lone hard break emits the empty HTML value', async () => {
  const changes = []
  const mounted = await mount({ value: '', onChange: (html) => changes.push(html) })

  await act(async () => mounted.editor.commands.insertContent('<br>'))
  assert.equal(mounted.editor.getHTML(), '<p><br></p>')
  assert.deepEqual(changes, [''])
  await mounted.unmount()
})

test('disabled and placeholder updates keep the current document', async () => {
  const props = { value: '', placeholder: 'Nhập nội dung' }
  const mounted = await mount(props)
  assert.equal(mounted.container.querySelector('[data-placeholder]')?.getAttribute('data-placeholder'), 'Nhập nội dung')

  await mounted.render({ ...props, placeholder: 'Mô tả', disabled: true })
  assert.equal(mounted.editor.isEditable, false)
  assert.equal(mounted.container.querySelector('[data-placeholder]')?.getAttribute('data-placeholder'), 'Mô tả')
  assert.equal(mounted.editor.isEmpty, true)

  await mounted.render({ ...props, placeholder: 'Mô tả' })
  assert.equal(mounted.editor.isEditable, true)
  await mounted.render({ ...props, value: '<p>Nội dung</p>', placeholder: 'Mô tả' })
  await act(async () => mounted.editor.commands.setTextSelection(4))
  const selection = mounted.editor.state.selection.from
  await mounted.render({ ...props, value: '<p>Nội dung</p>', placeholder: 'Gợi ý khác' })
  assert.equal(mounted.editor.getHTML(), '<p>Nội dung</p>')
  assert.equal(mounted.editor.state.selection.from, selection)
  await mounted.unmount()
})
