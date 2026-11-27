import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLButtonElement',
  'Element',
  'Node',
  'MutationObserver',
  'CustomEvent',
  'Event',
])
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: name === 'window' ? dom.window : dom.window[name],
  })
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
  dom.window,
)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
window.scrollTo = () => {}
dom.window.HTMLElement.prototype.attachEvent = () => {}
dom.window.HTMLElement.prototype.detachEvent = () => {}
const { act, createElement: h } = await import('react')
const { createRoot } = await import('react-dom/client')
const { Provider } = await import('react-redux')
const { createMemoryRouter, RouterProvider } = await import('react-router-dom')

const vite = await createServer({
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
})
const load = (path) => vite.ssrLoadModule(`/src/${path}`)
const { default: RootLayout } = await load('components/layouts/RootLayout.jsx')
const { default: Profile } = await load(
  'features/company-management/components/CompanyProfile.jsx',
)
const { default: client } = await load('apis/client/index.js')
const { store } = await load('store/store.js')
const auth = await load('features/authentication/slice.js')
store.dispatch(
  auth.authenticated({
    user: {
      id: 'cm',
      fullName: 'Nguyễn Minh Anh',
      role: 'COMPANY_STAFF',
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  }),
)
store.dispatch(
  auth.accountContextResolved({
    membership: { id: 'cm-member', role: 'COMPANY_MANAGER', status: 'ACTIVE' },
  }),
)
const company = {
  name: 'An Phúc',
  businessRegistrationNumber: '0319287645',
  address: 'Địa chỉ ban đầu',
  description: '',
  descriptionHtml: '',
  website: '',
  contactInfo: '',
  logoUrl: '',
  bannerUrl: '',
}
const pause = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 20))
  })
const wait = async (fn) => {
  for (let i = 0; i < 100; i++) {
    await pause()
    if (fn()) return
  }
  throw Error('Timeout ' + document.body.textContent)
}
const fill = async (value) => {
  const input = document.querySelector('input[name="address"]')
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    ).set.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}
let rootView, router
async function mount() {
  client.get = async () => ({ data: { company: { ...company } } })
  const container = document.createElement('div')
  document.body.append(container)
  rootView = createRoot(container)
  router = createMemoryRouter(
    [
      {
        element: h(RootLayout),
        children: [
          { path: '/company/profile', element: h(Profile) },
          { path: '/company/jobs', element: h('p', null, 'Job list') },
        ],
      },
    ],
    { initialEntries: ['/company/profile'] },
  )
  await act(async () =>
    rootView.render(h(Provider, { store }, h(RouterProvider, { router }))),
  )
  await wait(() => document.querySelector('input[name="address"]'))
}
const saveButton = () =>
  [...document.querySelectorAll('button')].find(
    (b) => b.textContent === 'Lưu hồ sơ công ty',
  )

after(async () => {
  await vite.close()
  dom.window.close()
})
async function close() {
  await act(async () => rootView.unmount())
  document.body.innerHTML = ''
}
test('pending image uploads block saving and protect departure', async () => {
  let finishUpload
  let payload
  client.post = () =>
    new Promise((r) => {
      finishUpload = r
    })
  client.patch = async (_url, body) => {
    payload = body
    return { data: { company: { ...company, ...body } } }
  }
  await mount()
  try {
    const fileInput = document.querySelector('input[type="file"]')
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new window.File(['png'], 'logo.png', { type: 'image/png' })],
    })
    await act(async () =>
      fileInput.dispatchEvent(new window.Event('change', { bubbles: true })),
    )
    assert.equal(saveButton().disabled, true)
    await act(async () => saveButton().click())
    assert.equal(payload, undefined)
    await act(async () => router.navigate('/company/jobs'))
    await pause()
    assert.equal(router.state.location.pathname, '/company/profile')
    assert(document.querySelector('[role="alertdialog"]'))
    const cancel = document.querySelector('[role="alertdialog"] button')
    await act(async () => cancel.click())
    await act(async () =>
      finishUpload({
        data: { image: { url: 'https://anphuc.example/logo.png' } },
      }),
    )
    await pause()
    assert.equal(saveButton().disabled, false)
    await act(async () => saveButton().click())
    await wait(() => payload)
    assert.equal(payload.logoUrl, 'https://anphuc.example/logo.png')
  } finally {
    await close()
  }
})
test('profile text fields remain locked until PATCH finishes', async () => {
  let finishSave
  let sent
  client.patch = (_url, body) =>
    new Promise((r) => {
      sent = body
      finishSave = r
    })
  await mount()
  try {
    await fill('Địa chỉ A')
    await act(async () => saveButton().click())
    await wait(() => finishSave)
    assert.equal(document.querySelector('input[name="address"]').disabled, true)
    assert.equal(document.querySelector('input[name="website"]').disabled, true)
  } finally {
    if (finishSave)
      await act(async () =>
        finishSave({ data: { company: { ...company, ...sent } } }),
      )
    await pause()
    assert.equal(
      document.querySelector('input[name="address"]').disabled,
      false,
    )
    await close()
  }
})

test('failed uploads release the save lock and departure guard', async () => {
  let failUpload
  client.post = () =>
    new Promise((_resolve, reject) => {
      failUpload = reject
    })
  await mount()
  try {
    const input = document.querySelector('input[type="file"]')
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new window.File(['png'], 'logo.png', { type: 'image/png' })],
    })
    await act(async () =>
      input.dispatchEvent(new window.Event('change', { bubbles: true })),
    )
    assert.equal(saveButton().disabled, true)
    await act(async () => failUpload(new Error('Upload failed')))
    assert.equal(saveButton().disabled, false)
    await act(async () => router.navigate('/company/jobs'))
    assert.equal(router.state.location.pathname, '/company/jobs')
  } finally {
    await close()
  }
})

test('saving waits for both logo and banner when uploads overlap', async () => {
  const uploads = []
  client.post = () => new Promise((resolve) => uploads.push(resolve))
  await mount()
  try {
    for (const input of document.querySelectorAll('input[type="file"]')) {
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new window.File(['png'], 'brand.png', { type: 'image/png' })],
      })
      await act(async () =>
        input.dispatchEvent(new window.Event('change', { bubbles: true })),
      )
    }
    assert.equal(uploads.length, 2)
    await act(async () =>
      uploads[0]({
        data: { image: { url: 'https://anphuc.example/logo.png' } },
      }),
    )
    assert.equal(saveButton().disabled, true)
    await act(async () =>
      uploads[1]({
        data: { image: { url: 'https://anphuc.example/banner.png' } },
      }),
    )
    assert.equal(saveButton().disabled, false)
  } finally {
    await close()
  }
})
