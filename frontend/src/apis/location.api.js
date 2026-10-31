import apiClient from '@/apis/client'

async function listProvincesApi() {
  const response = await apiClient.get('/locations/provinces')
  return response.data
}

async function listDistrictLevelUnitsApi(provinceCode) {
  const response = await apiClient.get(
    `/locations/provinces/${encodeURIComponent(provinceCode)}/district-level-units`,
  )
  return response.data
}

export { listDistrictLevelUnitsApi, listProvincesApi }
