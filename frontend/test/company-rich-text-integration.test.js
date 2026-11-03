import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { Editor } from '@tiptap/core'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
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
const { act, createElement } = await import('react')
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router-dom')
const { Provider } = await import('react-redux')

const editors = []
const originalEmit = Editor.prototype.emit
Editor.prototype.emit = function (event, ...args) {
  if (event === 'beforeCreate') editors.push(this)
  return originalEmit.call(this, event, ...args)
}

const vite = await createServer({ appType: 'custom', server: { middlewareMode: true } })
const { default: apiClient } = await vite.ssrLoadModule('/src/apis/client/index.js')
const { default: CompanyProfileForm } = await vite.ssrLoadModule('/src/features/company-onboarding/components/CompanyProfileForm.jsx')
const { default: CompanyProfileCard } = await vite.ssrLoadModule('/src/components/common/CompanyProfileCard.jsx')
const { default: CompanyProfile } = await vite.ssrLoadModule('/src/features/job-discovery/components/CompanyProfile.jsx')
const { default: JobDetail } = await vite.ssrLoadModule('/src/features/job-discovery/components/JobDetail.jsx')
const { store } = await vite.ssrLoadModule('/src/store/store.js')
const { toCompanyDescriptionEditorValue, toCompanyDescriptionPlainText } = await vite.ssrLoadModule('/src/features/company-onboarding/utils.js')

const originalAdapter = apiClient.defaults.adapter
const requests = []
let savedCompany
let publicCompany
let publicJob
apiClient.defaults.adapter = async (config) => {
  if (config.method === 'get') {
    const data = {
      '/job-discovery/companies/company-1': { company: publicCompany },
      '/job-discovery/jobs/job-1': { job: publicJob },
      '/job-discovery/jobs': { jobs: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }, sort: 'NEWEST' },
      '/categories/fields': { fields: [] },
      '/locations/provinces': { provinces: [] },
    }[config.url]
    assert.ok(data, `Unexpected GET ${config.url}`)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  assert.equal(config.method, 'patch')
  assert.equal(config.url, '/company')
  const payload = JSON.parse(config.data)
  requests.push(payload)
  savedCompany = {
    ...savedCompany,
    ...payload,
    ...(Object.hasOwn(payload, 'descriptionHtml') && {
      descriptionHtml: payload.descriptionHtml || null,
      description: payload.descriptionHtml ? 'Updated company' : null,
    }),
  }
  return { data: { company: savedCompany }, status: 200, statusText: 'OK', headers: {}, config }
}

after(async () => {
  apiClient.defaults.adapter = originalAdapter
  Editor.prototype.emit = originalEmit
  await vite.close()
  dom.window.close()
})

const initialCompany = {
  name: 'ABC',
  businessRegistrationNumber: '0101234567',
  website: 'https://old.example',
  address: 'Ha Noi',
  contactInfo: 'hr@example.com',
  description: 'Original company',
  descriptionHtml: '<p><strong>Original</strong> company</p>',
  logoUrl: '',
  bannerUrl: '',
}

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

async function changeInput(input, value) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

async function click(button) {
  await act(async () => button.dispatchEvent(new window.MouseEvent('click', { bubbles: true })))
}

function saveButton(container) {
  return [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Lưu nháp'))
}

test('website-only PATCH preserves both descriptions, rich edit sends HTML only, response reset is clean', async () => {
  savedCompany = { ...initialCompany }
  requests.length = 0
  const saved = []
  const mounted = await mount(CompanyProfileForm, {
    company: initialCompany,
    onSaved: (company) => saved.push(company),
    onContinue: () => {},
    onStateChanged: () => {},
  })
  const editor = editors.at(-1)
  assert.equal(editor.getHTML(), initialCompany.descriptionHtml)

  await changeInput(mounted.container.querySelector('input[placeholder="https://abc-tech.vn"]'), 'https://new.example')
  await click(saveButton(mounted.container))
  assert.equal(requests.length, 1)
  assert.equal(requests[0].website, 'https://new.example')
  assert.equal(Object.hasOwn(requests[0], 'description'), false)
  assert.equal(Object.hasOwn(requests[0], 'descriptionHtml'), false)
  assert.equal(saved[0].descriptionHtml, initialCompany.descriptionHtml)
  assert.equal(saved[0].description, initialCompany.description)

  await act(async () => editor.commands.setContent('<p><strong>Updated</strong> company</p>'))
  await click(saveButton(mounted.container))
  assert.equal(requests.length, 2)
  assert.equal(requests[1].descriptionHtml, '<p><strong>Updated</strong> company</p>')
  assert.equal(Object.hasOwn(requests[1], 'description'), false)
  assert.equal(saved[1].description, 'Updated company')
  assert.equal(saved[1].descriptionHtml, requests[1].descriptionHtml)

  await click(saveButton(mounted.container))
  assert.equal(requests.length, 3)
  assert.equal(Object.hasOwn(requests[2], 'description'), false)
  assert.equal(Object.hasOwn(requests[2], 'descriptionHtml'), false)
  await mounted.unmount()
})

test('legacy plain text is escaped in the editor and untouched content is omitted from PATCH', async () => {
  const legacy = { ...initialCompany, description: '<script>plain</script>\nSecond line', descriptionHtml: null }
  savedCompany = { ...legacy }
  requests.length = 0
  assert.match(toCompanyDescriptionEditorValue(legacy), /&lt;script&gt;plain&lt;\/script&gt;/)
  assert.equal(toCompanyDescriptionPlainText('<p>First<br>Second</p>'), 'First\nSecond')
  const mounted = await mount(CompanyProfileForm, {
    company: legacy,
    onSaved: () => {},
    onContinue: () => {},
    onStateChanged: () => {},
  })
  assert.equal(editors.at(-1).getText(), '<script>plain</script>\nSecond line')
  await click(saveButton(mounted.container))
  assert.equal(Object.hasOwn(requests[0], 'description'), false)
  assert.equal(Object.hasOwn(requests[0], 'descriptionHtml'), false)
  await mounted.unmount()
})

test('legacy edit sends HTML, clearing content sends empty HTML, and continue uses the saved response', async () => {
  const legacy = { ...initialCompany, description: 'Legacy text', descriptionHtml: null }
  savedCompany = { ...legacy }
  requests.length = 0
  const continued = []
  const mounted = await mount(CompanyProfileForm, {
    company: legacy,
    onSaved: () => {},
    onContinue: (company) => continued.push(company),
    onStateChanged: () => {},
  })
  const editor = editors.at(-1)
  await act(async () => editor.commands.setContent('<p><strong>Updated</strong> company</p>'))
  await click(saveButton(mounted.container))
  assert.equal(requests[0].descriptionHtml, '<p><strong>Updated</strong> company</p>')
  assert.equal(Object.hasOwn(requests[0], 'description'), false)

  await act(async () => editor.commands.clearContent())
  await act(async () => {
    mounted.container.querySelector('form').dispatchEvent(new window.Event('submit', {
      bubbles: true,
      cancelable: true,
    }))
  })
  assert.equal(requests[1].descriptionHtml, '')
  assert.equal(Object.hasOwn(requests[1], 'description'), false)
  assert.equal(continued[0].descriptionHtml, null)
  assert.equal(continued[0].description, null)
  await mounted.unmount()
})

test('review and admin card presentations render sanitized HTML and legacy text', async () => {
  for (const presentation of ['review', 'default']) {
    const rich = await mount(CompanyProfileCard, {
      presentation,
      profile: {
        ...initialCompany,
        descriptionHtml: '<h2>Company</h2><p><a href="javascript:alert(1)">safe</a><script>alert(1)</script></p>',
      },
    })
    assert.ok(rich.container.querySelector('.rich-text-viewer h2'))
    assert.equal(rich.container.querySelector('.rich-text-viewer script'), null)
    assert.equal(rich.container.querySelector('.rich-text-viewer a').hasAttribute('href'), false)
    await rich.unmount()

    const plain = await mount(CompanyProfileCard, {
      presentation,
      profile: { ...initialCompany, descriptionHtml: null, description: '<b>Legacy</b>\nSecond line' },
    })
    const viewer = plain.container.querySelector('.rich-text-viewer')
    assert.equal(viewer.querySelector('b'), null)
    assert.equal(viewer.textContent, '<b>Legacy</b>\nSecond line')
    await plain.unmount()
  }
})

test('public Company profile reads HTML and falls back to escaped legacy text', async () => {
  publicCompany = { ...initialCompany, id: 'company-1' }
  const mounted = await mount(MemoryRouter, {
    children: createElement(Provider, { store }, createElement(CompanyProfile, { companyId: 'company-1' })),
  })
  await act(async () => {})
  assert.equal(mounted.container.querySelector('.rich-text-viewer strong').textContent, 'Original')
  await mounted.unmount()

  publicCompany = { ...initialCompany, id: 'company-1', descriptionHtml: null, description: '<b>Legacy</b>' }
  const legacy = await mount(MemoryRouter, {
    children: createElement(Provider, { store }, createElement(CompanyProfile, { companyId: 'company-1' })),
  })
  await act(async () => {})
  const viewer = legacy.container.querySelector('.rich-text-viewer')
  assert.equal(viewer.querySelector('b'), null)
  assert.equal(viewer.textContent, '<b>Legacy</b>')
  await legacy.unmount()
})

test('Job detail Company section reads Full HTML and legacy plain text', async () => {
  publicJob = {
    id: 'job-1',
    title: 'Role',
    company: { ...initialCompany, id: 'company-1' },
    fieldCategories: [],
    positionCategories: [],
    workModes: [],
    location: {},
    jobDescription: 'Job description',
  }
  const element = () => createElement(Provider, { store },
    createElement(MemoryRouter, null, createElement(JobDetail, { jobId: 'job-1' })))
  const rich = await mount(element, {})
  await act(async () => {})
  assert.equal(rich.container.querySelector('aside .rich-text-viewer strong').textContent, 'Original')
  await rich.unmount()

  publicJob = {
    ...publicJob,
    company: { ...publicJob.company, description: '<b>Legacy</b>', descriptionHtml: null },
  }
  const plain = await mount(element, {})
  await act(async () => {})
  const viewer = plain.container.querySelector('aside .rich-text-viewer')
  assert.equal(viewer.querySelector('b'), null)
  assert.equal(viewer.textContent, '<b>Legacy</b>')
  await plain.unmount()
})
