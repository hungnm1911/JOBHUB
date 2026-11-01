import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { Editor } from '@tiptap/core'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  globalThis[name] = name === 'window' ? dom.window : dom.window[name]
}
globalThis.getSelection = dom.window.getSelection.bind(dom.window)
globalThis.IS_REACT_ACT_ENVIRONMENT = true

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

test('full and minimal presets expose their intended nodes', async () => {
  const full = await mount({ value: '<h2>Title</h2>' })
  assert.ok(full.editor.schema.nodes.heading)
  assert.ok(full.editor.schema.nodes.bulletList)
  assert.equal(full.editor.getHTML(), '<h2>Title</h2>')
  await full.unmount()

  const minimal = await mount({ value: '<h2>Title</h2>', preset: 'minimal' })
  assert.equal(minimal.editor.schema.nodes.heading, undefined)
  assert.equal(minimal.editor.schema.nodes.bulletList, undefined)
  assert.ok(minimal.editor.schema.marks.bold)
  assert.equal(minimal.editor.getHTML(), '<p>Title</p>')
  await minimal.unmount()
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
