import apiClient from '@/apis/client'
import { API_CONFIG } from '@/utils/constant'

const PROTECTED_REQUEST = Object.freeze({
  requiresAuthentication: true,
})

const FILE_REQUEST = Object.freeze({
  ...PROTECTED_REQUEST,
  responseType: 'blob',
  timeout: API_CONFIG.FILE_UPLOAD_TIMEOUT_MS,
})

const id = encodeURIComponent

async function get(url, params) {
  const response = await apiClient.get(url, { ...PROTECTED_REQUEST, params })
  return response.data
}

async function post(url, body) {
  const response = await apiClient.post(url, body, PROTECTED_REQUEST)
  return response.data
}

const jobApplicationPath = (jobId, applicationId) =>
  `/jobs/${id(jobId)}/applications/${id(applicationId)}`
const myApplicationPath = (applicationId) => `/jobs/my-applications/${id(applicationId)}`

// Primary Recruiter view (V10).
const listJobApplicationsApi = (jobId, params) => get(`/jobs/${id(jobId)}/applications`, params)
const getJobApplicationApi = (jobId, applicationId) =>
  get(jobApplicationPath(jobId, applicationId))
const assignApplicationApi = (jobId, applicationId, body) =>
  post(`${jobApplicationPath(jobId, applicationId)}/assign`, body)
const reassignApplicationApi = (jobId, applicationId, body) =>
  post(`${jobApplicationPath(jobId, applicationId)}/reassign`, body)
const unassignApplicationApi = (jobId, applicationId, body) =>
  post(`${jobApplicationPath(jobId, applicationId)}/unassign`, body)

// Assigned Recruiter view (V10–V12).
const listMyApplicationsApi = (params) => get('/jobs/my-applications', params)
const getMyApplicationApi = (applicationId) => get(myApplicationPath(applicationId))
const updatePipelineStatusApi = (jobId, applicationId, body) =>
  post(`${jobApplicationPath(jobId, applicationId)}/pipeline`, body)
const createInterviewProposalApi = (jobId, applicationId, body) =>
  post(`${jobApplicationPath(jobId, applicationId)}/interview-proposals`, body)
const cancelInterviewProposalApi = (jobId, applicationId, scheduleId) =>
  post(`${jobApplicationPath(jobId, applicationId)}/interview-proposals/${id(scheduleId)}/cancel`)

// Submitted CV files; `jobId` selects the Primary view, otherwise the Assignee view.
function getSubmittedCvFileApi({ jobId, applicationId, disposition }) {
  const base = jobId ? jobApplicationPath(jobId, applicationId) : myApplicationPath(applicationId)
  return apiClient.get(`${base}/submitted-cv/${disposition}`, FILE_REQUEST)
}

// Conversations (V11).
const listMyConversationsApi = (params) => get('/jobs/my-conversations', params)
const getMyApplicationConversationApi = (applicationId, params) =>
  get(`${myApplicationPath(applicationId)}/conversation`, params)
const sendMyApplicationMessageApi = (applicationId, content) =>
  post(`${myApplicationPath(applicationId)}/conversation/messages`, { content })

export {
  assignApplicationApi,
  cancelInterviewProposalApi,
  createInterviewProposalApi,
  getJobApplicationApi,
  getMyApplicationApi,
  getMyApplicationConversationApi,
  getSubmittedCvFileApi,
  listJobApplicationsApi,
  listMyApplicationsApi,
  listMyConversationsApi,
  reassignApplicationApi,
  sendMyApplicationMessageApi,
  unassignApplicationApi,
  updatePipelineStatusApi,
}
