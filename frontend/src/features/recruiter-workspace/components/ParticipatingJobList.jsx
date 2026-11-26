import { BriefcaseBusiness, SearchX } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { listRecruiterJobsApi } from '@/apis/recruiter-job.api'
import { ErrorState, ListSkeleton, Pager, StateMessage } from '@/components/common/ListStates'
import { Button } from '@/components/ui/button'
import { SelectDropdown } from '@/components/ui/select-dropdown'
import { selectMembership } from '@/features/authentication/slice'
import { useAppSelector } from '@/store/hooks'
import { JOB_STATUS } from '@/utils/constant'

import useListSearch, { toListQuery, useDebouncedValue } from '../hooks/useListSearch'
import useResource from '../hooks/useResource'
import {
  JOB_LIST_SCOPE,
  JOB_ROLE,
  JOB_STATUS_LABEL,
  formatDay,
  getEffectiveJobStatus,
} from '../utils'
import JobStatusBadge, { JobRoleChip } from './JobStatusBadge'
import { FilterBar, ListCard, SearchInput } from './Panel'

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Mới nhất' },
  { value: 'createdAt', label: 'Cũ nhất' },
  { value: 'title', label: 'Tiêu đề A–Z' },
  { value: 'applicationDeadline', label: 'Hạn nộp gần nhất' },
  { value: '-applicationDeadline', label: 'Hạn nộp xa nhất' },
]
const SEARCH_SPEC = Object.freeze({
  q: 'text',
  status: ['', ...Object.values(JOB_STATUS)],
  sort: SORT_OPTIONS.map((option) => option.value),
})

// The team scope only returns Jobs the actor belongs to, so a non-Primary row is Supporting.
const roleOf = (job, membershipId) =>
  job.primaryRecruiterCompanyMemberId === membershipId ? JOB_ROLE.PRIMARY : JOB_ROLE.SUPPORTING

function ParticipatingJobList() {
  const membership = useAppSelector(selectMembership)
  const { search, setFilters, setPage, reset } = useListSearch(SEARCH_SPEC)
  const keyword = useDebouncedValue(search.q)
  const query = useMemo(
    () => ({ ...toListQuery({ ...search, q: keyword }), scope: JOB_LIST_SCOPE.MY_TEAM }),
    [search, keyword],
  )
  const { data, loading, error, reload } = useResource(listRecruiterJobsApi, query)
  const hasFilters = Boolean(search.q || search.status)

  let body
  if (loading) body = <ListSkeleton label="Đang tải danh sách Job" />
  else if (error) body = <ErrorState error={error} onRetry={reload} />
  else if (data.jobs.length === 0) {
    body = (
      <StateMessage
        action={
          hasFilters ? (
            <Button onClick={reset} size="sm" type="button" variant="outline">
              Xóa bộ lọc
            </Button>
          ) : null
        }
        description={hasFilters ? 'Không có Job nào khớp với bộ lọc.' : 'Bạn chưa phụ trách hoặc hỗ trợ Job nào.'}
        icon={hasFilters ? SearchX : BriefcaseBusiness}
        title={hasFilters ? 'Không có kết quả' : 'Chưa có Job'}
      />
    )
  } else {
    body = (
      <>
        <ul className="divide-y">
          {data.jobs.map((job) => {
            return (
              <li className="flex flex-wrap items-center gap-3 px-4 py-4" key={job.id}>
                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    className="font-semibold break-words outline-none hover:text-primary focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
                    to={`/recruiter/my-applications?jobId=${job.id}`}
                  >
                    {job.title || 'Chưa đặt tiêu đề'}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <JobStatusBadge status={getEffectiveJobStatus(job)} />
                    <JobRoleChip role={roleOf(job, membership?.id)} />
                    <span>Hạn nộp: {formatDay(job.applicationDeadline) ?? 'chưa đặt'}</span>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/recruiter/jobs/${job.id}`}>Thông tin Job</Link>
                </Button>
              </li>
            )
          })}
        </ul>
        <Pager onPageChange={setPage} pagination={data.pagination} unit="Job" />
      </>
    )
  }

  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchInput label="Tìm theo tiêu đề Job" onChange={(q) => setFilters({ q })} value={search.q} />
        <div className="grid gap-3 sm:grid-cols-2 lg:flex">
          <SelectDropdown
            ariaLabel="Lọc theo trạng thái"
            className="lg:w-44"
            onChange={(status) => setFilters({ status })}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              ...Object.values(JOB_STATUS).map((value) => ({ value, label: JOB_STATUS_LABEL[value] })),
            ]}
            value={search.status}
          />
          <SelectDropdown
            ariaLabel="Sắp xếp"
            className="lg:w-44"
            onChange={(sort) => setFilters({ sort })}
            options={SORT_OPTIONS}
            value={search.sort}
          />
        </div>
      </FilterBar>
      <ListCard label="Job được giao">{body}</ListCard>
    </div>
  )
}

export default ParticipatingJobList
