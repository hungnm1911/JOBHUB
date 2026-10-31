import apiClient from '@/apis/client'

async function listFieldCategoriesApi() {
  const response = await apiClient.get('/categories/fields')
  return response.data
}

async function listPositionCategoriesApi(fieldId) {
  const response = await apiClient.get(
    `/categories/fields/${encodeURIComponent(fieldId)}/positions`,
  )
  return response.data
}

export { listFieldCategoriesApi, listPositionCategoriesApi }
