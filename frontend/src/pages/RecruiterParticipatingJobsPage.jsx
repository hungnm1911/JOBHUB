import RecruiterPageHeader from '@/features/recruiter-workspace/components/RecruiterPageHeader'
import ParticipatingJobList from '@/features/recruiter-workspace/components/ParticipatingJobList'

function RecruiterParticipatingJobsPage() {
  return (
    <div className="space-y-5">
      <RecruiterPageHeader
        description="Job bạn phụ trách chính hoặc hỗ trợ. Mở một Job để xem hồ sơ được giao cho bạn."
        title="Job được giao"
      />
      <ParticipatingJobList />
    </div>
  )
}

export default RecruiterParticipatingJobsPage
