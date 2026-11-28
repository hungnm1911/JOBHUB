import apiClient from '@/apis/client'

async function listFieldCategoriesApi(params) {
  const response = await apiClient.get('/categories/fields', { params })
  return response.data
}

async function listPositionCategoriesApi(fieldId, params) {
  const response = await apiClient.get(
    `/categories/fields/${encodeURIComponent(fieldId)}/positions`,
    { params },
  )
  return response.data
}

export { listFieldCategoriesApi, listPositionCategoriesApi }
