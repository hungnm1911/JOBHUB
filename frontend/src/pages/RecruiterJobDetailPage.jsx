import { useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { getRecruiterJobApi } from '@/apis/recruiter-job.api'
import { ErrorState, ListSkeleton } from '@/components/common/ListStates'
import { selectMembership } from '@/features/authentication/slice'
import BackLink from '@/features/recruiter-workspace/components/BackLink'
import JobApplicationsTab from '@/features/recruiter-workspace/components/JobApplicationsTab'
import JobDetailHeader from '@/features/recruiter-workspace/components/JobDetailHeader'
import JobInvitationsTab from '@/features/recruiter-workspace/components/JobInvitationsTab'
import JobOverviewTab from '@/features/recruiter-workspace/components/JobOverviewTab'
import JobPipelineTab from '@/features/recruiter-workspace/components/JobPipelineTab'
import JobTeamTab from '@/features/recruiter-workspace/components/JobTeamTab'
import ScrollFade from '@/features/recruiter-workspace/components/ScrollFade'
import useResource from '@/features/recruiter-workspace/hooks/useResource'
import { cn } from '@/lib/utils'
import { useAppSelector } from '@/store/hooks'

const TABS = Object.freeze([
  { key: 'overview', label: 'Tổng quan' },
  { key: 'pipeline', label: 'Tiến trình', primaryOnly: true },
  { key: 'applications', label: 'Danh sách ứng viên', primaryOnly: true },
  { key: 'team', label: 'Đội tuyển dụng' },
  { key: 'invitations', label: 'Lời mời', primaryOnly: true },
])

function JobDetail({ job, membershipId, onChanged }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const isPrimary = job.primaryRecruiterCompanyMemberId === membershipId
  const tabs = TABS.filter((tab) => isPrimary || !tab.primaryOnly)
  const active = tabs.find((tab) => tab.key === searchParams.get('tab'))?.key ?? 'overview'
  const tabListRef = useRef(null)
  // Each tab starts with its own clean filters.
  const select = (key) => setSearchParams(key === 'overview' ? {} : { tab: key })

  // Keep the selected tab in view on narrow screens.
  useEffect(() => {
    tabListRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [active])

  const handleTabKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.key === active)
    const target = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key]
    if (target === undefined) return
    event.preventDefault()
    select(tabs[target].key)
    tabListRef.current?.querySelector(`#job-tab-${tabs[target].key}`)?.focus()
  }

  return (
    <div className="space-y-5">
      <JobDetailHeader isPrimary={isPrimary} job={job} onChanged={onChanged}>
      <ScrollFade fadeClassName="from-card">
        <div
          aria-label="Mục quản lý Job"
          className="flex min-w-max gap-1"
          onKeyDown={handleTabKeyDown}
          ref={tabListRef}
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              aria-controls="job-tabpanel"
              aria-selected={tab.key === active}
              className={cn(
                'border-b-2 px-3 py-2.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring',
                tab.key === active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              id={`job-tab-${tab.key}`}
              key={tab.key}
              onClick={() => select(tab.key)}
              role="tab"
              tabIndex={tab.key === active ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </ScrollFade>
      </JobDetailHeader>

      <div aria-labelledby={`job-tab-${active}`} id="job-tabpanel" role="tabpanel" tabIndex={0}>
        {active === 'overview' && (
          <JobOverviewTab isPrimary={isPrimary} job={job} onChanged={onChanged} />
        )}
        {active === 'pipeline' && <JobPipelineTab jobId={job.id} />}
        {active === 'applications' && <JobApplicationsTab jobId={job.id} />}
        {active === 'team' && <JobTeamTab isPrimary={isPrimary} job={job} />}
        {active === 'invitations' && <JobInvitationsTab jobId={job.id} />}
      </div>
    </div>
  )
}

function RecruiterJobDetailPage() {
  const { jobId } = useParams()
  const membership = useAppSelector(selectMembership)
  const { data, loading, error, reload } = useResource(getRecruiterJobApi, jobId)

  if (loading) return <ListSkeleton label="Đang tải Job" />
  if (error) {
    return (
      <div className="space-y-4">
        <BackLink to="/recruiter/jobs">Quay lại danh sách Job</BackLink>
        <ErrorState error={error} onRetry={reload} />
      </div>
    )
  }

  return <JobDetail job={data.job} membershipId={membership?.id ?? null} onChanged={reload} />
}

export default RecruiterJobDetailPage
