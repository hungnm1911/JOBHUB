import { useParams } from 'react-router-dom'

import CandidateApplicationDetail from '@/features/candidate-applications/components/CandidateApplicationDetail'

function CandidateApplicationDetailPage() {
  const { applicationId } = useParams()
  return <CandidateApplicationDetail applicationId={applicationId} />
}

export default CandidateApplicationDetailPage
