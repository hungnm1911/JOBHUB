import apiClient from '@/apis/client'
import { API_CONFIG } from '@/utils/constant'

const AUTHENTICATED_REQUEST = Object.freeze({ requiresAuthentication: true })

// AI-V06 R1: no persistence; returns { baseline, proposedContent, proposal }.
async function previewOptimizedCandidateCvForJobApi({
  jobId,
  candidateCvId,
  evaluationResult,
}) {
  const response = await apiClient.post(
    `/candidate/jobs/${encodeURIComponent(jobId)}/optimize-cv/preview`,
    { candidateCvId, evaluationResult },
    { ...AUTHENTICATED_REQUEST, timeout: API_CONFIG.EMAIL_DELIVERY_TIMEOUT_MS },
  )
  return response.data
}

// AI-V06 R3: the signed Proposal is sent exactly as Preview issued it; no AI call.
async function commitOptimizedCandidateCvProposalForJobApi({ jobId, proposal }) {
  const response = await apiClient.post(
    `/candidate/jobs/${encodeURIComponent(jobId)}/optimize-cv/commit`,
    { proposal },
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

export {
  commitOptimizedCandidateCvProposalForJobApi,
  previewOptimizedCandidateCvForJobApi,
}
