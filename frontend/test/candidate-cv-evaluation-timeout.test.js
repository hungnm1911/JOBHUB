import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { createServer } from 'vite'

const vite = await createServer({
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
})
const { default: apiClient } = await vite.ssrLoadModule('/src/apis/client/index.js')
const { evaluateOwnCandidateCvForJobApi } = await vite.ssrLoadModule(
  '/src/apis/candidate-cv-evaluation.api.js',
)
const originalAdapter = apiClient.defaults.adapter

after(async () => {
  apiClient.defaults.adapter = originalAdapter
  await vite.close()
})

test('Uploaded PDF evaluation waits for normalization and evaluation inference', async () => {
  let requestConfig
  apiClient.defaults.adapter = async (config) => {
    requestConfig = config
    return { data: { evaluationResult: { matchScore: 80 } }, status: 200,
      headers: {}, config }
  }

  const response = await evaluateOwnCandidateCvForJobApi({ jobId: 'job-1',
    candidateCvId: 'cv-1' })

  assert.deepEqual(response.evaluationResult, { matchScore: 80 })
  assert.equal(requestConfig.method, 'post')
  assert.equal(requestConfig.url, '/candidate/jobs/job-1/evaluate-cv')
  assert.deepEqual(JSON.parse(requestConfig.data), { candidateCvId: 'cv-1' })
  assert.equal(requestConfig.requiresAuthentication, true)
  // PDF normalization may use 90s; evaluation inference may use 120s.
  assert.ok(requestConfig.timeout > 210_000, `Timeout ${requestConfig.timeout}ms is too short`)
})
