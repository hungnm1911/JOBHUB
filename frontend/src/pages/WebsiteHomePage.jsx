import useSessionViewer from '@/features/authentication/hooks/useSessionViewer'
import HomePage from '@/pages/HomePage'
import CompanyHomePage from '@/pages/CompanyHomePage'
import RecruiterHomePage from '@/pages/RecruiterHomePage'

function WebsiteHomePage() {
  const viewer = useSessionViewer()
  if (viewer.isCompanyManager) return <CompanyHomePage key={viewer.userId} />
  return viewer.isRecruiter ? <RecruiterHomePage /> : <HomePage />
}

export default WebsiteHomePage
