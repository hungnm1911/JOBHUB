import ApplyJobButton from '@/features/applications/components/ApplyJobButton'
import SaveJobButton from '@/features/saved-jobs/components/SaveJobButton'

function DiscoveryJobActions({ job, viewer, revealApplyOnHover = false }) {
  return (
    <div className="relative z-10 flex items-center gap-2">
      <ApplyJobButton
        acceptingApplications={job.isAcceptingApplications !== false}
        jobId={job.id}
        jobTitle={job.title}
        revealOnHover={revealApplyOnHover}
        viewer={viewer}
      />
      <SaveJobButton initialSaved={job.isSaved} jobId={job.id} jobTitle={job.title} viewer={viewer} />
    </div>
  )
}

export default DiscoveryJobActions
