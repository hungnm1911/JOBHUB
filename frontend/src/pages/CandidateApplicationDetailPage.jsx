import { useParams } from 'react-router-dom'

import CandidateApplicationDetail from '@/features/candidate-applications/components/CandidateApplicationDetail'

function CandidateApplicationDetailPage() {
  const { applicationId } = useParams()
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-8">
      <CandidateApplicationDetail applicationId={applicationId} />
    </section>
  )
}

export default CandidateApplicationDetailPage
