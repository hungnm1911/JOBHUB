import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { createServer } from 'vite'

const vite = await createServer({
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
})
const { default: apiClient } = await vite.ssrLoadModule('/src/apis/client/index.js')
const { recommendOwnDefaultCvJobsApi } = await vite.ssrLoadModule(
  '/src/apis/candidate-job-recommendation.api.js',
)
const originalAdapter = apiClient.defaults.adapter

after(async () => {
  apiClient.defaults.adapter = originalAdapter
  await vite.close()
})

test('Uploaded PDF recommendation waits for normalization and batch assessment', async () => {
  let requestConfig
  apiClient.defaults.adapter = async (config) => {
    requestConfig = config
    return { data: { recommendations: [{ job: { id: 'job-1' } }] }, status: 200,
      headers: {}, config }
  }

  const response = await recommendOwnDefaultCvJobsApi()

  assert.deepEqual(response.recommendations, [{ job: { id: 'job-1' } }])
  assert.equal(requestConfig.method, 'post')
  assert.equal(requestConfig.url, '/candidate/job-recommendations')
  assert.equal(requestConfig.requiresAuthentication, true)
  // Two sequential AI calls may each use the provider's 90-second deadline.
  assert.ok(requestConfig.timeout > 180_000, `Timeout ${requestConfig.timeout}ms is too short`)
})
