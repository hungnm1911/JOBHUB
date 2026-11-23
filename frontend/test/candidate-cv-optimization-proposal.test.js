import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'

import { AxiosError } from 'axios'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true,
})
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement } = await import('react')
const { createRoot } = await import('react-dom/client')
const vite = await createServer({ appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } })
const { default: apiClient } = await vite.ssrLoadModule('/src/apis/client/index.js')
const { default: useCvOptimizationProposal } = await vite.ssrLoadModule(
  '/src/features/candidate-cv-optimization/hooks/useCvOptimizationProposal.js',
)
const originalAdapter = apiClient.defaults.adapter

after(async () => {
  apiClient.defaults.adapter = originalAdapter
  await vite.close()
  dom.window.close()
})

const FIELDS = ['skills', 'category', 'experience', 'employmentType', 'workMode']
const evaluationResult = {
  jobId: 'a'.repeat(24), candidateCvId: 'b'.repeat(24), matchScore: 50, overallSummary: 's',
  fieldReviews: FIELDS.map((criterion) => ({ criterion, score: 50, review: 'r' })),
  cvImprovements: [],
}
const proposal = { payload: { version: 1, metadata: { name: 'n' } }, signature: 'sig', extra: { keep: true } }
const previewBody = { baseline: { a: 1 }, proposedContent: { a: 2 }, proposal }

let requests
let respond
beforeEach(() => {
  requests = []
  respond = (config) => (config.url.endsWith('/preview')
    ? { status: 200, data: previewBody }
    : { status: 201, data: { cv: { id: 'draft-1' } } })
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    const result = respond(config)
    if (result.status >= 400) {
      throw new AxiosError('fail', 'ERR_BAD_REQUEST', config, null, {
        status: result.status, data: {}, headers: {}, config,
      })
    }
    return { headers: {}, config, ...result }
  }
})

async function mount(initial) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const view = { current: null }
  const Probe = (props) => { view.current = useCvOptimizationProposal(props); return null }
  const render = (props) => act(async () => root.render(createElement(Probe, props)))
  await render(initial)
  return { view, render, unmount: () => act(async () => root.unmount()) }
}

const ids = { jobId: 'job-1', candidateCvId: 'cv-1' }

test('Preview then Commit sends the Proposal untouched and never re-optimizes', async () => {
  const h = await mount(ids)
  await act(async () => { await h.view.current.requestPreview(evaluationResult) })
  assert.equal(h.view.current.previewStatus, 'ready')
  assert.equal(requests[0].url, '/candidate/jobs/job-1/optimize-cv/preview')
  assert.equal(h.view.current.proposal, proposal)

  await act(async () => { await h.view.current.commit() })
  assert.equal(requests.length, 2)
  assert.equal(requests[1].url, '/candidate/jobs/job-1/optimize-cv/commit')
  assert.deepEqual(JSON.parse(requests[1].data), { proposal })
  assert.equal(h.view.current.commitStatus, 'success')
  assert.deepEqual(h.view.current.draftCv, { id: 'draft-1' })

  await act(async () => { await h.view.current.commit() })
  assert.equal(requests.length, 2, 'consumed Proposal cannot be committed twice')
  await h.unmount()
})

test('commit without a Proposal is a no-op', async () => {
  const h = await mount(ids)
  assert.equal(await h.view.current.commit(), null)
  assert.equal(requests.length, 0)
  await h.unmount()
})

test('Source CV or Job change clears the Proposal', async () => {
  for (const next of [{ ...ids, candidateCvId: 'cv-2' }, { ...ids, jobId: 'job-2' }]) {
    const h = await mount(ids)
    await act(async () => { await h.view.current.requestPreview(evaluationResult) })
    assert.ok(h.view.current.proposal)
    await h.render(next)
    assert.equal(h.view.current.proposal, null)
    assert.equal(h.view.current.previewStatus, 'idle')
    const before = requests.length
    await act(async () => { await h.view.current.commit() })
    assert.equal(requests.length, before)
    await h.unmount()
  }
})

test('Preview error is exposed and leaves no Proposal', async () => {
  respond = () => ({ status: 500 })
  const h = await mount(ids)
  await act(async () => { await h.view.current.requestPreview(evaluationResult).catch(() => {}) })
  assert.equal(h.view.current.previewStatus, 'error')
  assert.ok(h.view.current.previewError)
  assert.equal(h.view.current.proposal, null)
  await h.unmount()
})

test('Commit 409 discards the Proposal; 500 keeps it for retry', async () => {
  const h = await mount(ids)
  await act(async () => { await h.view.current.requestPreview(evaluationResult) })

  respond = () => ({ status: 500 })
  await act(async () => { await h.view.current.commit().catch(() => {}) })
  assert.equal(h.view.current.commitStatus, 'error')
  assert.equal(h.view.current.proposal, proposal)

  respond = () => ({ status: 409 })
  await act(async () => { await h.view.current.commit().catch(() => {}) })
  assert.equal(h.view.current.commitStatus, 'error')
  assert.equal(h.view.current.proposal, null)
  await h.unmount()
})
