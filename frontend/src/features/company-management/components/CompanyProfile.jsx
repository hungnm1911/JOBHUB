import { getOwnedCompanyApi } from '@/apis/company.api'
import { ErrorState, ListSkeleton } from '@/components/common/ListStates'
import PageHeader from '@/components/common/PageHeader'
import { CompanyProfileForm } from '@/features/company-onboarding/public'
import { useResource } from '@/features/recruiter-workspace/public'

function CompanyProfile() {
  const { data, loading, error, reload } = useResource(getOwnedCompanyApi)
  if (loading) return <ListSkeleton label="Đang tải hồ sơ công ty" />
  if (error) return <ErrorState error={error} onRetry={reload} />
  return (
    <div className="space-y-6">
      <PageHeader
        description="Cập nhật các thông tin được phép không đưa công ty về xét duyệt lại."
        title="Hồ sơ công ty"
      />
      <CompanyProfileForm
        active
        company={data.company}
        onSaved={reload}
        onStateChanged={reload}
      />
    </div>
  )
}

export default CompanyProfile
