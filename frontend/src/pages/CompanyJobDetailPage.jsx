import { useParams } from 'react-router-dom'

import CompanyJobDetail from '@/features/company-management/components/CompanyJobDetail'

export default function CompanyJobDetailPage() {
  const { jobId } = useParams()
  return <CompanyJobDetail jobId={jobId} key={jobId} />
}
