import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

import { getMyApplicationApi } from '@/apis/recruiter-application.api'
import { ErrorState, ListSkeleton } from '@/components/common/ListStates'
import ApplicationStatusBadge from '@/features/candidate-dashboard/components/ApplicationStatusBadge'
import {
  SourceLabel,
  SubmittedCvPanel,
  WithdrawnNotice,
} from '@/features/recruiter-workspace/components/ApplicationBits'
import BackLink from '@/features/recruiter-workspace/components/BackLink'
import ChatPanel from '@/features/recruiter-workspace/components/ChatPanel'
import InterviewPanel from '@/features/recruiter-workspace/components/InterviewPanel'
import { Avatar } from '@/features/recruiter-workspace/components/Panel'
import PipelinePanel from '@/features/recruiter-workspace/components/PipelinePanel'
import RecruiterPageHeader from '@/features/recruiter-workspace/components/RecruiterPageHeader'
import useResource from '@/features/recruiter-workspace/hooks/useResource'
import { formatMoment } from '@/features/recruiter-workspace/utils'
import { subscribeRealtimeEvent } from '@/socket/realtime-subscriptions'
import { REALTIME_EVENT, SOCKET_LIFECYCLE_EVENT } from '@/utils/constant'

function ApplicationDetail({ applicationId }) {
  const { data, loading, error, reload } = useResource(getMyApplicationApi, applicationId)

  // Candidate actions (availability, confirm, withdraw) arrive as notifications.
  useEffect(() => {
    const offNotification = subscribeRealtimeEvent(REALTIME_EVENT.NOTIFICATION, (payload) => {
      if (payload?.notification?.applicationId === applicationId) reload()
    })
    const offConnect = subscribeRealtimeEvent(SOCKET_LIFECYCLE_EVENT.CONNECT, reload)
    return () => {
      offNotification()
      offConnect()
    }
  }, [applicationId, reload])

  if (loading || error) {
    return (
      <>
        <BackLink to="/recruiter/participating">Quay lại Job được giao</BackLink>
        {loading ? (
          <ListSkeleton label="Đang tải hồ sơ" />
        ) : (
          <ErrorState
            error={error}
            forbiddenDescription="Hồ sơ này hiện không được giao cho bạn."
            onRetry={reload}
          />
        )}
      </>
    )
  }

  const { application } = data

  return (
    <div className="space-y-5">
      <RecruiterPageHeader
        badges={<ApplicationStatusBadge status={application.status} />}
        breadcrumbs={[
          { label: 'Job được giao', to: '/recruiter/participating' },
          {
            label: application.job?.title ?? 'Hồ sơ trong Job',
            to: `/recruiter/my-applications?jobId=${application.jobId}`,
          },
          { label: application.candidate?.fullName ?? 'Ứng viên' },
        ]}
        description={
          <>
            {application.job?.title} · <SourceLabel source={application.source} /> · nộp{' '}
            {formatMoment(application.appliedAt)}
          </>
        }
        leading={<Avatar className="size-12" person={application.candidate} />}
        title={application.candidate?.fullName ?? 'Ứng viên'}
      />
      <WithdrawnNotice application={application} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <div className="min-w-0 space-y-4">
          <PipelinePanel application={application} onChanged={reload} />
          <SubmittedCvPanel application={application} />
          <InterviewPanel application={application} onChanged={reload} />
        </div>
        <ChatPanel
          applicationId={application.id}
          candidate={application.candidate}
          className="xl:sticky xl:top-20"
          key={`${application.id}-${application.status}`}
        />
      </div>
    </div>
  )
}

function RecruiterMyApplicationPage() {
  const { applicationId } = useParams()

  return (
    <div className="space-y-4">
      <ApplicationDetail applicationId={applicationId} key={applicationId} />
    </div>
  )
}

export default RecruiterMyApplicationPage
