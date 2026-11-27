import { useParams } from 'react-router-dom'

import CompanyRecruiterDetail from '@/features/company-management/components/CompanyRecruiterDetail'

export default function CompanyRecruiterDetailPage() {
  const { recruiterId } = useParams()
  return <CompanyRecruiterDetail key={recruiterId} recruiterId={recruiterId} />
}
