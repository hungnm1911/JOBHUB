import CompanySupportConversation from '@/features/company-support/components/CompanySupportConversation'
import useSessionViewer from '@/features/authentication/hooks/useSessionViewer'
function CompanySupportPage() {
  const viewer = useSessionViewer()
  return <CompanySupportConversation key={viewer.userId} />
}
export default CompanySupportPage
