import apiClient from '@/apis/client'

async function listExperienceLevelsApi() {
  const response = await apiClient.get('/experience-levels')
  return response.data
}

export { listExperienceLevelsApi }
