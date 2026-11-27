import useSessionViewer from '@/features/authentication/hooks/useSessionViewer'
import HomePage from '@/pages/HomePage'
import RecruiterHomePage from '@/pages/RecruiterHomePage'

function WebsiteHomePage() {
  const viewer = useSessionViewer()
  return viewer.isRecruiter ? <RecruiterHomePage /> : <HomePage />
}

export default WebsiteHomePage
