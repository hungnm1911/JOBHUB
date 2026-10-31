import { useParams } from 'react-router-dom'

import CompanyProfile from '@/features/job-discovery/components/CompanyProfile'

function CompanyDetailPage() {
  const { companyId } = useParams()

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <CompanyProfile companyId={companyId} key={companyId} />
    </section>
  )
}

export default CompanyDetailPage
