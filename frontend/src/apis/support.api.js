import apiClient from '@/apis/client'
const request = { requiresAuthentication: true }
const listSupportConversationsApi = (params) =>
  apiClient
    .get('/platform-admin/support-conversations', { ...request, params })
    .then((r) => r.data)
const supportPath = (companyId) =>
  companyId
    ? `/platform-admin/companies/${encodeURIComponent(companyId)}/support/messages`
    : '/company/support/messages'
const getSupportMessagesApi = ({ companyId, ...params }) =>
  apiClient
    .get(supportPath(companyId), { ...request, params })
    .then((r) => r.data)
const sendSupportMessageApi = ({ companyId, ...body }) =>
  apiClient.post(supportPath(companyId), body, request).then((r) => r.data)
export {
  listSupportConversationsApi,
  getSupportMessagesApi,
  sendSupportMessageApi,
}
