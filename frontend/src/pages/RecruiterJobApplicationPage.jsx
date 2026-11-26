import { Info } from 'lucide-react'
import { useParams } from 'react-router-dom'

import { getJobApplicationApi } from '@/apis/recruiter-application.api'
import { ErrorState, ListSkeleton } from '@/components/common/ListStates'
import { selectMembership } from '@/features/authentication/slice'
import ApplicationStatusBadge from '@/features/candidate-dashboard/components/ApplicationStatusBadge'
import {
  AvailabilityList,
  ScheduleHistory,
  SubmittedCvPanel,
  WithdrawnNotice,
} from '@/features/recruiter-workspace/components/ApplicationBits'
import { SourceChip } from '@/features/recruiter-workspace/components/ApplicationChips'
import AssignmentPanel from '@/features/recruiter-workspace/components/AssignmentPanel'
import BackLink from '@/features/recruiter-workspace/components/BackLink'
import Panel, { Avatar } from '@/features/recruiter-workspace/components/Panel'
import RecruiterPageHeader from '@/features/recruiter-workspace/components/RecruiterPageHeader'
import useResource from '@/features/recruiter-workspace/hooks/useResource'
import { formatMoment } from '@/features/recruiter-workspace/utils'
import { useAppSelector } from '@/store/hooks'

const loadApplication = ({ jobId, applicationId }) => getJobApplicationApi(jobId, applicationId)

function RecruiterJobApplicationPage() {
  const { jobId, applicationId } = useParams()
  const membership = useAppSelector(selectMembership)
  const { data, loading, error, reload } = useResource(loadApplication, { jobId, applicationId })
  const back = (
    <BackLink to={`/recruiter/jobs/${jobId}?tab=applications`}>Quay lại danh sách ứng viên</BackLink>
  )

  if (loading) return <ListSkeleton label="Đang tải hồ sơ" />
  if (error) {
    return (
      <div className="space-y-4">
        {back}
        <ErrorState
          error={error}
          forbiddenDescription="Chỉ người phụ trách chính của Job xem được hồ sơ này."
          onRetry={reload}
        />
      </div>
    )
  }

  const { job, application } = data

  return (
    <div className="space-y-5">
      <RecruiterPageHeader
        badges={
          <>
            <ApplicationStatusBadge status={application.status} />
            <SourceChip source={application.source} />
          </>
        }
        breadcrumbs={[
          { label: 'Job tôi phụ trách chính', to: '/recruiter/jobs' },
          { label: job.title, to: `/recruiter/jobs/${job.id}?tab=applications` },
          { label: application.candidate?.fullName ?? 'Ứng viên' },
        ]}
        description={`Nộp ngày ${formatMoment(application.appliedAt)} · ${job.title}`}
        leading={<Avatar className="size-12" person={application.candidate} />}
        title={application.candidate?.fullName ?? 'Ứng viên'}
      />
      {application.assignedRecruiterCompanyMemberId !== membership?.id && (
        <p className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Chỉ người được phân công mới cập nhật trạng thái và nhắn tin với ứng viên.
        </p>
      )}
      <WithdrawnNotice application={application} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0">
          <SubmittedCvPanel application={application} inline jobId={job.id} />
        </div>
        <div className="space-y-4">
          <AssignmentPanel
            application={application}
            job={job}
            membershipId={membership?.id ?? null}
            onChanged={reload}
          />
          <Panel title="Lịch rảnh của ứng viên">
            <AvailabilityList availability={application.availability} />
          </Panel>
          <Panel title="Lịch phỏng vấn">
            <ScheduleHistory schedules={application.interviewSchedules} />
          </Panel>
        </div>
      </div>
    </div>
  )
}

export default RecruiterJobApplicationPage
