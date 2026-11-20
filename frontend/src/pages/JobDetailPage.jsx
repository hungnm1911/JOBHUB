import { useParams } from 'react-router-dom'

import useSessionViewer from '@/features/authentication/hooks/useSessionViewer'
import EvaluateCvButton from '@/features/candidate-cv-evaluation/components/EvaluateCvButton'
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
        renderJobAction={(job) => (
          <div className="relative z-10 flex flex-wrap items-center gap-2">
            <EvaluateCvButton jobId={job.id} jobTitle={job.title} viewer={viewer} />
            <DiscoveryJobActions job={job} viewer={viewer} />
          </div>
        )}
      />
    </section>
  )
}

export default JobDetailPage
