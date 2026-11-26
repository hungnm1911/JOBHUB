import RecruiterPageHeader from '@/features/recruiter-workspace/components/RecruiterPageHeader'
import MyApplicationList from '@/features/recruiter-workspace/components/MyApplicationList'

function RecruiterMyApplicationsPage() {
  return (
    <div className="space-y-5">
      <RecruiterPageHeader
        breadcrumbs={[
          { label: 'Job được giao', to: '/recruiter/participating' },
          { label: 'Hồ sơ được giao' },
        ]}
        title="Hồ sơ được giao cho tôi"
      />
      <MyApplicationList />
    </div>
  )
}

export default RecruiterMyApplicationsPage
