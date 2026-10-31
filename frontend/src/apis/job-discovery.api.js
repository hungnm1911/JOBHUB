import apiClient from '@/apis/client'

// Job Discovery uses optional authentication: the access token is attached
// only when a session exists, so the backend applies the signed-in actor rules.
const OPTIONALLY_AUTHENTICATED_REQUEST = Object.freeze({
  requiresAuthentication: true,
})

const JOB_DISCOVERY_PATH = '/job-discovery'

async function listDiscoveryJobsApi({
  keyword,
  categories,
  locations,
  workModes,
  employmentTypes,
  experienceLevels,
  salaryPeriod,
  salaryMin,
  salaryMax,
  sort,
  page,
  limit,
} = {}) {
  const response = await apiClient.get(`${JOB_DISCOVERY_PATH}/jobs`, {
    ...OPTIONALLY_AUTHENTICATED_REQUEST,
    params: {
      keyword,
      categories,
      locations,
      workModes,
      employmentTypes,
      experienceLevels,
      salaryPeriod,
      salaryMin,
      salaryMax,
      sort,
      page,
      limit,
    },
  })
  return response.data
}

async function getDiscoveryJobApi(jobId) {
  const response = await apiClient.get(
    `${JOB_DISCOVERY_PATH}/jobs/${encodeURIComponent(jobId)}`,
    OPTIONALLY_AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function getDiscoveryCompanyApi(companyId) {
  const response = await apiClient.get(
    `${JOB_DISCOVERY_PATH}/companies/${encodeURIComponent(companyId)}`,
    OPTIONALLY_AUTHENTICATED_REQUEST,
  )
  return response.data
}

export { getDiscoveryCompanyApi, getDiscoveryJobApi, listDiscoveryJobsApi }
