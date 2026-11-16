import apiClient from '@/apis/client'
import { API_CONFIG } from '@/utils/constant'

const AUTHENTICATED_REQUEST = Object.freeze({ requiresAuthentication: true })

async function listOwnCandidateCvsApi() {
  const response = await apiClient.get('/candidate/cvs', AUTHENTICATED_REQUEST)
  return response.data
}

async function getOwnCandidateCvApi(cvId) {
  const response = await apiClient.get(
    `/candidate/cvs/${encodeURIComponent(cvId)}`,
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function createGeneratedDraftCandidateCvApi(draft) {
  const response = await apiClient.post('/candidate/cvs', draft, AUTHENTICATED_REQUEST)
  return response.data
}

async function createUploadedCandidateCvApi({ file, fields }) {
  const body = new FormData()
  const fileName = file.name?.toLowerCase().endsWith('.pdf')
    ? file.name
    : `${file.name || 'candidate-cv'}.pdf`
  body.append('file', file, fileName)
  body.append('name', fields.name)
  body.append('visibility', fields.visibility)
  body.append('categoryId', fields.categoryId)

  if (fields.experienceLevelId) {
    body.append('experienceLevelId', fields.experienceLevelId)
  }
  if (fields.skillTags?.length) {
    body.append('skillTags', JSON.stringify(fields.skillTags))
  }
  if (fields.employmentTypes?.length) {
    body.append('employmentTypes', JSON.stringify(fields.employmentTypes))
  }
  if (fields.workModes?.length) {
    body.append('workModes', JSON.stringify(fields.workModes))
  }
  if (fields.preferredLocations?.length) {
    body.append('preferredLocations', JSON.stringify(fields.preferredLocations))
  }

  const response = await apiClient.post('/candidate/cvs/uploaded', body, {
    ...AUTHENTICATED_REQUEST,
    timeout: API_CONFIG.FILE_UPLOAD_TIMEOUT_MS,
  })
  return response.data
}

async function updateOwnCandidateCvMetadataApi(cvId, patch) {
  const response = await apiClient.patch(
    `/candidate/cvs/${encodeURIComponent(cvId)}`,
    patch,
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function saveOwnGeneratedContentApi(cvId, generatedContent) {
  const response = await apiClient.put(
    `/candidate/cvs/${encodeURIComponent(cvId)}/generated-content`,
    generatedContent,
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function previewOwnCandidateCvApi(cvId) {
  const response = await apiClient.get(
    `/candidate/cvs/${encodeURIComponent(cvId)}/preview`,
    {
      ...AUTHENTICATED_REQUEST,
      responseType: 'blob',
      timeout: API_CONFIG.FILE_UPLOAD_TIMEOUT_MS,
    },
  )
  return response
}

async function downloadOwnCandidateCvApi(cvId) {
  const response = await apiClient.get(
    `/candidate/cvs/${encodeURIComponent(cvId)}/download`,
    {
      ...AUTHENTICATED_REQUEST,
      responseType: 'blob',
      timeout: API_CONFIG.FILE_UPLOAD_TIMEOUT_MS,
    },
  )
  return response
}

async function replaceOwnUploadedCandidateCvPdfApi(cvId, file) {
  const body = new FormData()
  const fileName = file.name?.toLowerCase().endsWith('.pdf')
    ? file.name
    : `${file.name || 'candidate-cv'}.pdf`
  body.append('file', file, fileName)

  const response = await apiClient.put(
    `/candidate/cvs/${encodeURIComponent(cvId)}/uploaded-file`,
    body,
    {
      ...AUTHENTICATED_REQUEST,
      timeout: API_CONFIG.FILE_UPLOAD_TIMEOUT_MS,
    },
  )
  return response.data
}

async function activateOwnGeneratedCandidateCvApi(cvId) {
  const response = await apiClient.post(
    `/candidate/cvs/${encodeURIComponent(cvId)}/activate`,
    {},
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function setOwnCandidateCvAsDefaultApi(cvId) {
  const response = await apiClient.put(
    `/candidate/cvs/${encodeURIComponent(cvId)}/default`,
    {},
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function unsetOwnCandidateCvDefaultApi(cvId) {
  const response = await apiClient.delete(
    `/candidate/cvs/${encodeURIComponent(cvId)}/default`,
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function archiveOwnCandidateCvApi(cvId) {
  const response = await apiClient.delete(
    `/candidate/cvs/${encodeURIComponent(cvId)}`,
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

export {
  activateOwnGeneratedCandidateCvApi,
  archiveOwnCandidateCvApi,
  createGeneratedDraftCandidateCvApi,
  createUploadedCandidateCvApi,
  downloadOwnCandidateCvApi,
  getOwnCandidateCvApi,
  listOwnCandidateCvsApi,
  previewOwnCandidateCvApi,
  replaceOwnUploadedCandidateCvPdfApi,
  saveOwnGeneratedContentApi,
  setOwnCandidateCvAsDefaultApi,
  unsetOwnCandidateCvDefaultApi,
  updateOwnCandidateCvMetadataApi,
}
