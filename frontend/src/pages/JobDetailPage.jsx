import { useParams } from 'react-router-dom'

import useSessionViewer from '@/features/authentication/hooks/useSessionViewer'
import JobDetail from '@/features/job-discovery/components/JobDetail'
import DiscoveryJobActions from '@/pages/discovery-job-actions'

function JobDetailPage() {
  const { jobId } = useParams()
  const viewer = useSessionViewer()

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <JobDetail
        jobId={jobId}
        key={jobId}
        renderJobAction={(job) => <DiscoveryJobActions job={job} viewer={viewer} />}
      />
    </section>
  )
}

export default JobDetailPage
