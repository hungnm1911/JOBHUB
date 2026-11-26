import { useState } from 'react'
import { Link } from 'react-router-dom'

import { getJobPipelineWorkspaceApi, getJobTeamApi } from '@/apis/recruiter-job.api'
import { ErrorState, ListSkeleton } from '@/components/common/ListStates'
import { APPLICATION_STATUS_LABEL } from '@/features/candidate-dashboard/utils'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS } from '@/utils/constant'

import ScrollFade from './ScrollFade'
import useResource from '../hooks/useResource'
import { PIPELINE_STATUSES, formatDay } from '../utils'
import { AssigneeChip, SourceChip } from './ApplicationChips'
import { Avatar } from './Panel'

const STATUS_DOT = Object.freeze({
  [APPLICATION_STATUS.APPLIED]: 'bg-slate-400',
  [APPLICATION_STATUS.SCREENING]: 'bg-sky-500',
  [APPLICATION_STATUS.CONTACTED]: 'bg-indigo-500',
  [APPLICATION_STATUS.INTERVIEW_SCHEDULED]: 'bg-amber-500',
  [APPLICATION_STATUS.INTERVIEW_COMPLETED]: 'bg-violet-500',
  [APPLICATION_STATUS.HIRED]: 'bg-emerald-500',
  [APPLICATION_STATUS.REJECTED]: 'bg-rose-500',
  [APPLICATION_STATUS.WITHDRAWN]: 'bg-slate-300',
})

// The team read is refused on ended Jobs; names then come from the Applications only.
const loadTeamOrNull = (jobId) => getJobTeamApi(jobId).catch(() => null)

function indexTeamMembers(team, applications) {
  const byId = new Map()
  const members = [team?.team?.primaryRecruiter, ...(team?.team?.supportingRecruiters ?? [])]
  for (const member of [...members, ...applications.map((item) => item.assignedRecruiter)]) {
    if (member?.fullName) byId.set(member.companyMemberId, member)
  }
  return byId
}

function PipelineCard({ jobId, application }) {
  return (
    <li>
      <Link
        className="block space-y-2.5 rounded-lg border bg-card p-3 outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
        to={`/recruiter/jobs/${jobId}/applications/${application.id}`}
      >
        <span className="flex items-center gap-2">
          <Avatar className="size-8" person={application.candidate} />
          <span className="min-w-0 text-sm font-semibold break-words">
            {application.candidate?.fullName ?? 'Ứng viên'}
          </span>
        </span>
        <span className="flex flex-wrap items-center justify-between gap-1.5">
          <SourceChip source={application.source} />
          <span className="text-xs text-muted-foreground">Nộp ngày {formatDay(application.appliedAt)}</span>
        </span>
        <span className="flex">
          <AssigneeChip recruiter={application.assignedRecruiter} />
        </span>
      </Link>
    </li>
  )
}

function PipelineSummary({ data, members, unassignedOnly, onUnassignedOnlyChange }) {
  const total = PIPELINE_STATUSES.reduce((sum, status) => sum + (data.pipeline[status]?.length ?? 0), 0)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card px-4 py-3 text-sm ">
        <p>
          Tổng hồ sơ: <span className="font-semibold">{total}</span>
        </p>
        <p>
          Chưa phân công: <span className="font-semibold">{data.unassignedCount}</span>
        </p>
        <label className="flex min-h-10 cursor-pointer items-center gap-2 font-medium sm:ml-auto">
          <input
            checked={unassignedOnly}
            className="size-4 accent-primary"
            onChange={(event) => onUnassignedOnlyChange(event.target.checked)}
            type="checkbox"
          />
          Chỉ hiện hồ sơ chưa phân công
        </label>
      </div>
      <section className="rounded-xl border bg-card px-4 py-3 ">
        <h2 className="text-xs font-medium text-muted-foreground">Đang xử lý theo người</h2>
        {data.currentWorkloadByAssignee.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Chưa có hồ sơ nào đang được xử lý.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {data.currentWorkloadByAssignee.map((entry) => {
              const member = members.get(entry.companyMemberId)
              return (
                <li className="flex min-w-0 items-center gap-2 text-sm" key={entry.companyMemberId}>
                  <Avatar className="size-6" person={member} />
                  <span className="min-w-0 break-words">
                    {member?.fullName ?? 'Nhà tuyển dụng không còn trong đội'}
                  </span>
                  <span className="text-muted-foreground">
                    {entry.count}
                    <span className="sr-only"> hồ sơ</span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function JobPipelineTab({ jobId }) {
  const workspace = useResource(getJobPipelineWorkspaceApi, jobId)
  const team = useResource(loadTeamOrNull, jobId)
  const [unassignedOnly, setUnassignedOnly] = useState(false)

  if (workspace.loading) return <ListSkeleton label="Đang tải tiến trình" />
  if (workspace.error) return <ErrorState error={workspace.error} onRetry={workspace.reload} />

  const data = workspace.data
  const unassignedIds = new Set(data.unassignedApplications.map((item) => item.id))
  const members = indexTeamMembers(team.data, data.applications)

  return (
    <div className="space-y-4">
      <PipelineSummary
        data={data}
        members={members}
        onUnassignedOnlyChange={setUnassignedOnly}
        unassignedOnly={unassignedOnly}
      />

      <ScrollFade aria-label="Hồ sơ theo trạng thái" className="pb-2" role="region" tabIndex={0}>
        <div className="flex min-w-max gap-3">
          {PIPELINE_STATUSES.map((status) => {
            const all = data.pipeline[status] ?? []
            const items = unassignedOnly ? all.filter((item) => unassignedIds.has(item.id)) : all
            return (
              <section className="w-72 shrink-0 rounded-xl bg-secondary/70 p-2" key={status}>
                <h3 className="flex items-center gap-2 px-1 py-1 text-sm font-semibold">
                  <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[status])} />
                  <span className="min-w-0 flex-1">{APPLICATION_STATUS_LABEL[status]}</span>
                  <span className="font-normal text-muted-foreground">{items.length}</span>
                </h3>
                <ul className="mt-2 space-y-2">
                  {items.map((application) => (
                    <PipelineCard application={application} jobId={jobId} key={application.id} />
                  ))}
                </ul>
                {items.length === 0 && (
                  <p className="px-1 py-4 text-xs text-muted-foreground">Không có hồ sơ.</p>
                )}
              </section>
            )
          })}
        </div>
      </ScrollFade>

    </div>
  )
}

export default JobPipelineTab
