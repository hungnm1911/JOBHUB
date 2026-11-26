import apiClient from '@/apis/client'

const PROTECTED_REQUEST = Object.freeze({
  requiresAuthentication: true,
})

function toJobPath(jobId) {
  return `/jobs/${encodeURIComponent(jobId)}`
}

async function get(url, params) {
  const response = await apiClient.get(url, { ...PROTECTED_REQUEST, params })
  return response.data
}

async function post(url, body) {
  const response = await apiClient.post(url, body, PROTECTED_REQUEST)
  return response.data
}

async function remove(url) {
  const response = await apiClient.delete(url, PROTECTED_REQUEST)
  return response.data
}

// Internal Job list: scope, q, status, sort, page, limit.
const listRecruiterJobsApi = (params) => get('/jobs', params)
// V10 F06: Primary-only projection with Application counts per managed Job.
const listManagedJobsApi = (params) => get('/jobs/managed', params)
const getRecruiterJobApi = (jobId) => get(toJobPath(jobId))
const createDraftJobApi = (content) => post('/jobs', content)

async function updateDraftJobApi(jobId, content) {
  const response = await apiClient.patch(toJobPath(jobId), content, PROTECTED_REQUEST)
  return response.data
}

const submitDraftJobApi = (jobId) => post(`${toJobPath(jobId)}/submit`)
const closePublishedJobApi = (jobId) => post(`${toJobPath(jobId)}/close`)
const deleteDraftJobApi = (jobId) => remove(toJobPath(jobId))

// V6 Recruitment Team and V10 workspace.
const getJobPipelineWorkspaceApi = (jobId) => get(`${toJobPath(jobId)}/workspace`)
const getJobTeamApi = (jobId) => get(`${toJobPath(jobId)}/team`)
const listSupportingOptionsApi = (jobId, params) =>
  get(`${toJobPath(jobId)}/team/supporting-options`, params)
const listAssignmentOptionsApi = (jobId, params) =>
  get(`${toJobPath(jobId)}/assignment-options`, params)
const addSupportingRecruiterApi = (jobId, supportingRecruiterCompanyMemberId) =>
  post(`${toJobPath(jobId)}/team/supporting`, { supportingRecruiterCompanyMemberId })
const removeSupportingRecruiterApi = (jobId, companyMemberId) =>
  remove(`${toJobPath(jobId)}/team/supporting/${encodeURIComponent(companyMemberId)}`)

export {
  addSupportingRecruiterApi,
  closePublishedJobApi,
  createDraftJobApi,
  deleteDraftJobApi,
  getJobPipelineWorkspaceApi,
  getJobTeamApi,
  getRecruiterJobApi,
  listAssignmentOptionsApi,
  listManagedJobsApi,
  listRecruiterJobsApi,
  listSupportingOptionsApi,
  removeSupportingRecruiterApi,
  submitDraftJobApi,
  updateDraftJobApi,
}
