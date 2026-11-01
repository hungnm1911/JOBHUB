import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { Editor } from '@tiptap/core'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  globalThis[name] = name === 'window' ? dom.window : dom.window[name]
}
globalThis.getSelection = dom.window.getSelection.bind(dom.window)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { act, createElement } = await import('react')
const { createRoot } = await import('react-dom/client')
const vite = await createServer({ appType: 'custom', server: { middlewareMode: true } })
const { default: RichTextViewer } = await vite.ssrLoadModule('/src/components/common/RichTextViewer.jsx')
const { default: RichTextEditor } = await vite.ssrLoadModule('/src/components/common/RichTextEditor.jsx')

after(async () => {
  await vite.close()
  dom.window.close()
})

async function mount(Component, props) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(createElement(Component, props)))
  return {
    container,
    async unmount() {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

test('full HTML keeps only F02 formatting and secures new-tab links', async () => {
  const value = '<h2 style="text-align: center">Title</h2>' +
    '<p style="text-align: justify"><span style="font-family: Georgia; font-size: 18px; color: rgb(255, 0, 0)"><strong><em><u>Text</u></em></strong></span> <mark>bright</mark></p>' +
    '<ul><li>One</li></ul><ol><li>Two</li></ol>' +
    '<p><a href="https://example.com/x" target="_blank" rel="opener">Link</a></p>'
  const mounted = await mount(RichTextViewer, { value, format: 'html', preset: 'full' })
  const viewer = mounted.container.querySelector('.rich-text-viewer')
  assert.equal(viewer.querySelector('h2').style.textAlign, 'center')
  assert.equal(viewer.querySelector('p').style.textAlign, 'justify')
  assert.equal(viewer.querySelector('span').style.fontFamily, 'Georgia')
  assert.equal(viewer.querySelector('span').style.fontSize, '18px')
  assert.equal(viewer.querySelector('span').style.color, 'rgb(255, 0, 0)')
  assert.equal(viewer.querySelector('strong em u').textContent, 'Text')
  assert.equal(viewer.querySelector('mark').textContent, 'bright')
  assert.deepEqual([...viewer.querySelectorAll('li')].map((item) => item.textContent), ['One', 'Two'])
  assert.equal(viewer.querySelector('a').getAttribute('href'), 'https://example.com/x')
  assert.equal(viewer.querySelector('a').getAttribute('target'), '_blank')
  assert.equal(viewer.querySelector('a').getAttribute('rel'), 'noopener noreferrer')
  await mounted.unmount()
})

test('dangerous markup, attributes, CSS and URLs are removed', async () => {
  const value = '<script>alert(1)</script><img src=x onerror=alert(2)>' +
    '<svg onload=alert(3)><circle></circle></svg>' +
    '<p onclick="alert(4)" style="text-align: center; position: fixed; background-image: url(javascript:alert(5))">Safe ' +
    '<span style="color: red; font-size: 999px; font-family: Georgia; background: url(x)">text</span></p>' +
    '<p><a href="javascript:alert(6)" target="_blank">bad</a> ' +
    '<a href="//evil.example/path" target="_blank">protocol relative</a> ' +
    '<a href="data:text/html,%3Cscript%3Ealert(1)%3C/script%3E">data</a> ' +
    '<a href="/jobs" target="_blank">local</a></p>'
  const mounted = await mount(RichTextViewer, { value, format: 'html' })
  const viewer = mounted.container.querySelector('.rich-text-viewer')
  assert.equal(viewer.querySelector('script, img, svg, circle'), null)
  assert.doesNotMatch(viewer.innerHTML, /onerror|onclick|onload|position|background|999px|javascript:/i)
  assert.equal(viewer.querySelector('p').getAttribute('style'), 'text-align: center')
  assert.equal(viewer.querySelector('span').getAttribute('style'), 'font-family: Georgia')
  const links = viewer.querySelectorAll('a')
  assert.equal(links[0].hasAttribute('href'), false)
  assert.equal(links[0].hasAttribute('target'), false)
  assert.equal(links[1].hasAttribute('href'), false)
  assert.equal(links[2].hasAttribute('href'), false)
  assert.equal(links[3].getAttribute('href'), '/jobs')
  assert.equal(links[3].getAttribute('rel'), 'noopener noreferrer')
  await mounted.unmount()
})

test('minimal preset keeps its shared formatting but drops full-only formatting', async () => {
  const mounted = await mount(RichTextViewer, {
    value: '<h1>Title</h1><p style="text-align: right"><span style="color: #123456"><strong>Bold</strong></span> <mark>mark</mark></p><ul><li><a href="mailto:a@example.com">Mail</a></li></ul>',
    format: 'html', preset: 'minimal',
  })
  const viewer = mounted.container.querySelector('.rich-text-viewer')
  assert.equal(viewer.querySelector('h1, span, mark, [style]'), null)
  assert.equal(viewer.querySelector('strong').textContent, 'Bold')
  assert.equal(viewer.querySelector('li a').getAttribute('href'), 'mailto:a@example.com')
  await mounted.unmount()
})

test('plain text is explicit and never interpreted as HTML', async () => {
  const mounted = await mount(RichTextViewer, { value: '<b>Legacy</b>\nNext line', format: 'plain' })
  const viewer = mounted.container.querySelector('.rich-text-viewer')
  assert.equal(viewer.querySelector('b'), null)
  assert.equal(viewer.textContent, '<b>Legacy</b>\nNext line')
  assert.equal(viewer.classList.contains('whitespace-pre-wrap'), true)
  await mounted.unmount()
})

test('ordered-list start and type survive Editor HTML to Viewer in both presets', async () => {
  const editors = []
  const originalEmit = Editor.prototype.emit
  Editor.prototype.emit = function (event, ...args) {
    if (event === 'beforeCreate') editors.push(this)
    return originalEmit.call(this, event, ...args)
  }
  try {
    for (const preset of ['full', 'minimal']) {
      for (const type of ['1', 'a', 'A', 'i', 'I']) {
        const editor = await mount(RichTextEditor, { value: `<ol start="5" type="${type}"><li>Item</li></ol>`, preset })
        const html = editors.at(-1).getHTML()
        const viewer = await mount(RichTextViewer, { value: html, format: 'html', preset })
        const list = viewer.container.querySelector('ol')
        assert.equal(list.getAttribute('start'), '5', html)
        assert.equal(list.getAttribute('type'), type === '1' ? null : type, html)
        await viewer.unmount()
        await editor.unmount()
      }
    }
  } finally {
    Editor.prototype.emit = originalEmit
  }
})

test('ordered-list attributes are validated and removed from other tags', async () => {
  const mounted = await mount(RichTextViewer, {
    value: '<ol start="-3" type="I"><li>Valid</li></ol><ol start="1" type="1"><li>Default</li></ol><ol start="1.5" type="x"><li>Invalid</li></ol><ul start="5" type="a"><li>Bullet</li></ul><p start="5" type="i">Text</p>',
    format: 'html', preset: 'minimal',
  })
  const [valid, defaultList, invalid] = mounted.container.querySelectorAll('ol')
  assert.equal(valid.getAttribute('start'), '-3')
  assert.equal(valid.getAttribute('type'), 'I')
  assert.equal(defaultList.getAttribute('start'), '1')
  assert.equal(defaultList.getAttribute('type'), '1')
  assert.equal(invalid.hasAttribute('start'), false)
  assert.equal(invalid.hasAttribute('type'), false)
  assert.equal(mounted.container.querySelector('ul').hasAttribute('start'), false)
  assert.equal(mounted.container.querySelector('ul').hasAttribute('type'), false)
  assert.equal(mounted.container.querySelector('p').hasAttribute('start'), false)
  await mounted.unmount()
})

test('Editor link commands and HTML reload agree with Viewer URL policy', async () => {
  const editors = []
  const originalEmit = Editor.prototype.emit
  Editor.prototype.emit = function (event, ...args) {
    if (event === 'beforeCreate') editors.push(this)
    return originalEmit.call(this, event, ...args)
  }
  try {
    for (const preset of ['full', 'minimal']) {
      for (const [href, allowed] of [
        ['https://example.com/path', true], ['http://example.com', true],
        ['mailto:person@example.com', true], ['tel:+1234567', true],
        ['/jobs', true], ['./jobs', true], ['../jobs', true], ['#details', true],
        ['ftp://example.com', false], ['sms:+1234567', false],
        ['javascript:alert(1)', false], ['data:text/html,evil', false],
        ['//evil.example/path', false],
      ]) {
        const editor = await mount(RichTextEditor, { value: '<p>Link</p>', preset })
        const instance = editors.at(-1)
        await act(async () => instance.commands.setTextSelection({ from: 1, to: 5 }))
        let accepted
        await act(async () => { accepted = instance.commands.setLink({ href }) })
        assert.equal(accepted, allowed, `${preset}: ${href}`)
        const html = instance.getHTML()
        const viewer = await mount(RichTextViewer, { value: html, format: 'html', preset })
        const link = viewer.container.querySelector('a')
        assert.equal(link?.getAttribute('href') ?? null, allowed ? href : null, `${preset}: ${href}`)
        await viewer.unmount()
        await editor.unmount()

        const reloaded = await mount(RichTextEditor, { value: `<p><a href="${href}">Link</a></p>`, preset })
        assert.equal(editors.at(-1).getHTML().includes(`href="${href}"`), allowed, `${preset} reload: ${href}`)
        await reloaded.unmount()
      }
    }
  } finally {
    Editor.prototype.emit = originalEmit
  }
})

test('Viewer independently removes links outside the shared URL policy', async () => {
  const mounted = await mount(RichTextViewer, {
    value: '<p><a href="ftp://example.com">FTP</a> <a href="sms:+1234567">SMS</a> <a href="mailto:person@example.com">Mail</a> <a href="../jobs">Local</a></p>',
    format: 'html', preset: 'minimal',
  })
  assert.deepEqual(
    [...mounted.container.querySelectorAll('a')].map((link) => link.getAttribute('href')),
    [null, null, 'mailto:person@example.com', '../jobs'],
  )
  await mounted.unmount()
})

test('paste and autolink use the Viewer URL allowlist', async () => {
  const editors = []
  const originalEmit = Editor.prototype.emit
  Editor.prototype.emit = function (event, ...args) {
    if (event === 'beforeCreate') editors.push(this)
    return originalEmit.call(this, event, ...args)
  }
  try {
    for (const [href, allowed] of [
      ['https://example.com', true], ['ftp://example.com', false], ['sms:+1234567', false],
    ]) {
      for (const method of ['paste', 'autolink']) {
        const editor = await mount(RichTextEditor, { value: '', preset: 'minimal' })
        const instance = editors.at(-1)
        await act(async () => {
          if (method === 'paste') instance.view.pasteText(href, new window.Event('paste'))
          else instance.commands.insertContent(`${href} `)
        })
        const html = instance.getHTML()
        const viewer = await mount(RichTextViewer, { value: html, format: 'html', preset: 'minimal' })
        assert.equal(Boolean(editor.container.querySelector('a[href]')), allowed, `${method}: ${href} ${html}`)
        assert.equal(Boolean(viewer.container.querySelector('a[href]')), allowed, `${method}: ${href} ${html}`)
        await viewer.unmount()
        await editor.unmount()
      }
    }
    for (const [href, allowed] of [['../jobs', true], ['ftp://example.com', false]]) {
      const editor = await mount(RichTextEditor, { value: '', preset: 'minimal' })
      const instance = editors.at(-1)
      await act(async () => instance.view.pasteHTML(`<a href="${href}">Link</a>`, new window.Event('paste')))
      const html = instance.getHTML()
      const viewer = await mount(RichTextViewer, { value: html, format: 'html', preset: 'minimal' })
      assert.equal(Boolean(editor.container.querySelector('a[href]')), allowed, `HTML paste: ${href} ${html}`)
      assert.equal(Boolean(viewer.container.querySelector('a[href]')), allowed, `HTML paste: ${href} ${html}`)
      await viewer.unmount()
      await editor.unmount()
    }
  } finally {
    Editor.prototype.emit = originalEmit
  }
})

test('HTML emitted by the editor renders in the viewer for both presets', async () => {
  const editors = []
  const originalEmit = Editor.prototype.emit
  Editor.prototype.emit = function (event, ...args) {
    if (event === 'beforeCreate') editors.push(this)
    return originalEmit.call(this, event, ...args)
  }
  try {
    for (const [preset, input, selector] of [
      ['full', '<h3 style="text-align: right"><span style="font-family: Times New Roman; font-size: 24px; color: #123456"><mark>Full</mark></span></h3>', 'h3 span mark'],
      ['minimal', '<p><strong>Minimal</strong> <a href="https://example.com" target="_blank">link</a></p>', 'p strong'],
    ]) {
      const editor = await mount(RichTextEditor, { value: input, preset })
      const html = editors.at(-1).getHTML()
      const viewer = await mount(RichTextViewer, { value: html, format: 'html', preset })
      assert.ok(viewer.container.querySelector(selector), html)
      assert.match(viewer.container.textContent, new RegExp(preset === 'full' ? 'Full' : 'Minimal'))
      if (preset === 'full') {
        assert.equal(viewer.container.querySelector('h3').style.textAlign, 'right')
        assert.equal(viewer.container.querySelector('span').style.fontFamily, 'Times New Roman')
        assert.equal(viewer.container.querySelector('span').style.fontSize, '24px')
        assert.equal(viewer.container.querySelector('span').style.color, 'rgb(18, 52, 86)')
      }
      else assert.equal(viewer.container.querySelector('a').getAttribute('rel'), 'noopener noreferrer')
      await viewer.unmount()
      await editor.unmount()
    }
  } finally {
    Editor.prototype.emit = originalEmit
  }
})
