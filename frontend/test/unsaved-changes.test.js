import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

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

const { act, createElement, useState } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createMemoryRouter, RouterProvider, useNavigate } = await import('react-router-dom')
const vite = await createServer({ appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } })
const { default: UnsavedChangesProvider } = await vite.ssrLoadModule('/src/components/common/UnsavedChangesProvider.jsx')
const { default: useUnsavedChangesPrompt } = await vite.ssrLoadModule('/src/components/common/useUnsavedChangesPrompt.js')

after(async () => {
  await vite.close()
  dom.window.close()
})

async function mount(Form) {
  const container = document.createElement('div')
  document.body.append(container)
  const router = createMemoryRouter([
    { path: '/', element: createElement(UnsavedChangesProvider, null, createElement(Form)) },
    { path: '/next', element: createElement('p', null, 'Next page') },
  ])
  const root = createRoot(container)
  await act(async () => root.render(createElement(RouterProvider, { router })))
  return { container, router, async unmount() {
    await act(async () => root.unmount())
    router.dispose()
    container.remove()
  } }
}

async function click(text) {
  const button = [...document.querySelectorAll('button')].find((node) => node.textContent === text)
  assert.ok(button, `Expected button ${text}`)
  await act(async () => button.dispatchEvent(new window.MouseEvent('click', { bubbles: true })))
}

async function input(element, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value)
    element.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

test('clean forms navigate without a prompt', async () => {
  function Form() {
    useUnsavedChangesPrompt(false)
    return createElement('p', null, 'Clean form')
  }
  const view = await mount(Form)
  try {
    await act(async () => view.router.navigate('/next'))
    assert.equal(view.router.state.location.pathname, '/next')
    assert.equal(document.querySelector('[role="alertdialog"]'), null)
  } finally { await view.unmount() }
})

test('dirty form guards local cancel, route navigation and reload; save disarms the guard', async () => {
  let canceled = 0
  function Form() {
    const [value, setValue] = useState('')
    const { confirmDiscard, markSaved } = useUnsavedChangesPrompt(Boolean(value))
    return createElement('div', null,
      createElement('input', { 'aria-label': 'Draft', value, onChange: (event) => setValue(event.target.value) }),
      createElement('button', { onClick: () => confirmDiscard(() => { canceled += 1 }) }, 'Hủy'),
      createElement('button', { onClick: markSaved }, 'Lưu'),
    )
  }
  const view = await mount(Form)
  try {
    await input(view.container.querySelector('input'), 'Draft text')
    await click('Hủy')
    assert.ok(document.querySelector('[role="alertdialog"]'))
    assert.equal(canceled, 0)
    await click('Ở lại')
    assert.equal(canceled, 0)
    assert.equal(view.container.querySelector('input').value, 'Draft text')

    const unload = new window.Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    assert.equal(unload.defaultPrevented, true)

    await act(async () => view.router.navigate('/next'))
    assert.equal(view.router.state.location.pathname, '/')
    assert.ok(document.querySelector('[role="alertdialog"]'))
    await click('Ở lại')
    assert.equal(view.router.state.location.pathname, '/')

    await click('Lưu')
    const savedUnload = new window.Event('beforeunload', { cancelable: true })
    window.dispatchEvent(savedUnload)
    assert.equal(savedUnload.defaultPrevented, false)
    await act(async () => view.router.navigate('/next'))
    assert.equal(view.router.state.location.pathname, '/next')
  } finally { await view.unmount() }
})

test('confirming a blocked route navigation proceeds once', async () => {
  function Form() {
    const [value, setValue] = useState('')
    useUnsavedChangesPrompt(Boolean(value))
    return createElement('input', { 'aria-label': 'Draft', value, onChange: (event) => setValue(event.target.value) })
  }
  const view = await mount(Form)
  try {
    await input(view.container.querySelector('input'), 'Changed')
    await act(async () => view.router.navigate('/next'))
    assert.equal(view.router.state.location.pathname, '/')
    await click('Rời đi')
    assert.equal(view.router.state.location.pathname, '/next')
    assert.equal(document.querySelectorAll('[role="alertdialog"]').length, 0)
  } finally { await view.unmount() }
})

test('confirming a local Cancel navigation leaves without another prompt', async () => {
  function Form() {
    const navigate = useNavigate()
    const [value, setValue] = useState('')
    const { confirmDiscard } = useUnsavedChangesPrompt(Boolean(value))
    return createElement('div', null,
      createElement('input', { value, onChange: (event) => setValue(event.target.value) }),
      createElement('button', { onClick: () => confirmDiscard(() => navigate('/next')) }, 'Hủy'),
    )
  }
  const view = await mount(Form)
  try {
    await input(view.container.querySelector('input'), 'Changed')
    await click('Hủy')
    await click('Rời đi')
    assert.equal(view.router.state.location.pathname, '/next')
    assert.equal(document.querySelectorAll('[role="alertdialog"]').length, 0)
  } finally { await view.unmount() }
})

test('one shared blocker protects two dirty forms until both are clean', async () => {
  function Field({ label }) {
    const [value, setValue] = useState('')
    useUnsavedChangesPrompt(Boolean(value))
    return createElement('input', {
      'aria-label': label,
      value,
      onChange: (event) => setValue(event.target.value),
    })
  }
  function Form() {
    return createElement('div', null,
      createElement(Field, { label: 'First' }),
      createElement(Field, { label: 'Second' }),
    )
  }
  const view = await mount(Form)
  try {
    const [first, second] = view.container.querySelectorAll('input')
    await input(first, 'A')
    await input(second, 'B')
    await act(async () => view.router.navigate('/next'))
    assert.equal(document.querySelectorAll('[role="alertdialog"]').length, 1)
    await click('Ở lại')
    await input(first, '')
    await act(async () => view.router.navigate('/next'))
    assert.equal(view.router.state.location.pathname, '/')
    await click('Ở lại')
    await input(second, '')
    await act(async () => view.router.navigate('/next'))
    assert.equal(view.router.state.location.pathname, '/next')
  } finally { await view.unmount() }
})
