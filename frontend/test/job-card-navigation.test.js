import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  globalThis[name] = name === 'window' ? dom.window : dom.window[name]
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement, Fragment } = await import('react')
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, useLocation } = await import('react-router-dom')
const vite = await createServer({ appType: 'custom', server: { middlewareMode: true } })
const { default: JobCard } = await vite.ssrLoadModule('/src/features/job-discovery/components/JobCard.jsx')
const { default: JobResultCard } = await vite.ssrLoadModule('/src/features/job-discovery/components/JobResultCard.jsx')
const { default: DiscoveryJobActions } = await vite.ssrLoadModule('/src/pages/discovery-job-actions.jsx')

after(async () => {
  await vite.close()
  dom.window.close()
})

const job = {
  id: 'job-1',
  title: 'Mechanical Engineer',
  company: { id: 'company-1', name: 'Minh Technology Company' },
  fieldCategories: [],
  positionCategories: [],
  workModes: [],
}

function CurrentPath() {
  return createElement('output', { 'data-current-path': true }, useLocation().pathname)
}

async function mount(Card, withActions = false) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const action = withActions
    ? createElement(DiscoveryJobActions, { job, viewer: { resolved: true, role: null } })
    : undefined
  await act(async () => root.render(createElement(
    MemoryRouter,
    null,
    createElement(Fragment, null,
      createElement(Card, { job, action, provinceNameByCode: new Map() }),
      createElement(CurrentPath),
    ),
  )))

  return {
    container,
    path: () => container.querySelector('[data-current-path]').textContent,
    async unmount() {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

async function click(element) {
  assert.ok(element)
  await act(async () => element.dispatchEvent(new window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  })))
}

for (const Card of [JobCard, JobResultCard]) {
  test(`${Card.name}: job title and logo open Job detail; company name opens Company detail`, async () => {
    const mounted = await mount(Card)
    const card = mounted.container.querySelector('article')
    const jobLogo = card.querySelector('a[aria-label="Xem việc làm Mechanical Engineer"]')
    const companyName = [...card.querySelectorAll('a')].find((link) => link.textContent === job.company.name)
    const title = [...card.querySelectorAll('a')].find((link) => link.textContent === job.title)

    assert.equal(card.querySelectorAll('a[href="/jobs/job-1"]').length, 2)
    assert.equal(card.querySelectorAll('a[href="/companies/company-1"]').length, 1)
    await click(card)
    assert.equal(mounted.path(), '/')
    await click(jobLogo)
    assert.equal(mounted.path(), '/jobs/job-1')
    await click(companyName)
    assert.equal(mounted.path(), '/companies/company-1')
    await click(title)
    assert.equal(mounted.path(), '/jobs/job-1')
    await mounted.unmount()
  })

  for (const label of ['Đăng nhập để ứng tuyển', 'Đăng nhập để lưu việc làm']) {
    test(`${Card.name}: ${label} keeps its own action`, async () => {
      const mounted = await mount(Card, true)
      await click(mounted.container.querySelector(`button[aria-label="${label}"]`))
      assert.equal(mounted.path(), '/login')
      await mounted.unmount()
    })
  }
}
