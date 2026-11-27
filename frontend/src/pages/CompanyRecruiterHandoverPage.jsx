import { useParams, useSearchParams } from 'react-router-dom'

import RecruiterHandover from '@/features/company-management/components/RecruiterHandover'

export default function CompanyRecruiterHandoverPage() {
  const { recruiterId } = useParams()
  const [params] = useSearchParams()
  return (
    <RecruiterHandover
      key={`${recruiterId}:${params.get('intent')}`}
      recruiterId={recruiterId}
    />
  )
}
