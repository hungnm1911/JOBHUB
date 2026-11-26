import { Inbox, SearchX } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { listMyApplicationsApi } from '@/apis/recruiter-application.api'
import { listRecruiterJobsApi } from '@/apis/recruiter-job.api'
import { ErrorState, ListSkeleton, Pager, StateMessage } from '@/components/common/ListStates'
import { Button } from '@/components/ui/button'
import { SelectDropdown } from '@/components/ui/select-dropdown'
import ApplicationStatusBadge from '@/features/candidate-dashboard/components/ApplicationStatusBadge'
import { APPLICATION_STATUS_LABEL } from '@/features/candidate-dashboard/utils'
import { cn } from '@/lib/utils'
import { APPLICATION_SOURCE } from '@/utils/constant'

import useListSearch, { toListQuery, useDebouncedValue } from '../hooks/useListSearch'
import useResource from '../hooks/useResource'
import { JOB_LIST_SCOPE, PIPELINE_STATUSES, SOURCE_OPTIONS, formatDay } from '../utils'
import { SourceChip } from './ApplicationChips'
import { Avatar, FilterBar, ListCard, SearchInput } from './Panel'

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Nộp mới nhất' },
  { value: 'createdAt', label: 'Nộp cũ nhất' },
  { value: '-updatedAt', label: 'Mới cập nhật' },
  { value: 'updatedAt', label: 'Cập nhật cũ nhất' },
]
const SEARCH_SPEC = Object.freeze({
  q: 'text',
  jobId: 'id',
  status: ['', ...PIPELINE_STATUSES],
  source: ['', ...Object.values(APPLICATION_SOURCE)],
  sort: SORT_OPTIONS.map((option) => option.value),
})

// Job choices for the filter come from the actor's team Jobs.
const JOB_OPTION_QUERY = Object.freeze({ scope: JOB_LIST_SCOPE.MY_TEAM, sort: 'title', limit: 100 })

function MyApplicationList() {
  const { search, setFilters, setPage, reset } = useListSearch(SEARCH_SPEC)
  const keyword = useDebouncedValue(search.q)
  const query = useMemo(() => toListQuery({ ...search, q: keyword }), [search, keyword])
  const { data, loading, error, reload } = useResource(listMyApplicationsApi, query)
  const jobs = useResource(listRecruiterJobsApi, JOB_OPTION_QUERY)
  const hasFilters = Boolean(search.q || search.jobId || search.status || search.source)

  let body
  if (loading) body = <ListSkeleton label="Đang tải hồ sơ được giao" />
  else if (error) body = <ErrorState error={error} onRetry={reload} />
  else if (data.applications.length === 0) {
    body = (
      <StateMessage
        action={
          hasFilters ? (
            <Button onClick={reset} size="sm" type="button" variant="outline">
              Xóa bộ lọc
            </Button>
          ) : null
        }
        description={
          hasFilters ? 'Không có hồ sơ nào khớp với bộ lọc.' : 'Hiện chưa có hồ sơ nào được giao cho bạn.'
        }
        icon={hasFilters ? SearchX : Inbox}
        title={hasFilters ? 'Không có kết quả' : 'Chưa có hồ sơ'}
      />
    )
  } else {
    body = (
      <>
        <ul className="divide-y">
          {data.applications.map((application) => (
            <li key={application.id}>
              <Link
                className={cn(
                  'flex flex-wrap items-center gap-3 px-4 py-3 outline-none hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  !application.isActiveWorkload && 'bg-muted/60',
                )}
                to={`/recruiter/my-applications/${application.id}`}
              >
                <Avatar person={application.candidate} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold break-words">
                    {application.candidate?.fullName ?? 'Ứng viên'}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <SourceChip source={application.source} />
                    <span>{application.job?.title}</span>
                    <span>Nộp ngày {formatDay(application.appliedAt)}</span>
                    {!application.isActiveWorkload && <span className="font-semibold">Đã kết thúc</span>}
                  </span>
                </span>
                <ApplicationStatusBadge status={application.status} />
              </Link>
            </li>
          ))}
        </ul>
        <Pager onPageChange={setPage} pagination={data.pagination} unit="hồ sơ" />
      </>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground" role="status">
        Đang xử lý:{' '}
        <span className="font-semibold text-foreground tabular-nums">
          {data?.currentWorkloadCount ?? '…'}
        </span>{' '}
        hồ sơ
      </p>
      <FilterBar>
        <SearchInput
          label="Tìm theo tên ứng viên hoặc Job"
          onChange={(q) => setFilters({ q })}
          value={search.q}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:flex">
          <SelectDropdown
            ariaLabel="Lọc theo Job"
            className="lg:w-52"
            onChange={(jobId) => setFilters({ jobId })}
            options={[
              { value: '', label: 'Mọi Job' },
              ...(jobs.data?.jobs ?? []).map((job) => ({
                value: job.id,
                label: job.title || 'Chưa đặt tiêu đề',
              })),
            ]}
            searchable
            value={search.jobId}
          />
          <SelectDropdown
            ariaLabel="Lọc theo trạng thái"
            className="lg:w-44"
            onChange={(status) => setFilters({ status })}
            options={[
              { value: '', label: 'Mọi trạng thái' },
              ...PIPELINE_STATUSES.map((value) => ({ value, label: APPLICATION_STATUS_LABEL[value] })),
            ]}
            value={search.status}
          />
          <SelectDropdown
            ariaLabel="Lọc theo nguồn"
            className="lg:w-36"
            onChange={(source) => setFilters({ source })}
            options={SOURCE_OPTIONS}
            value={search.source}
          />
          <SelectDropdown
            ariaLabel="Sắp xếp"
            className="lg:w-40"
            onChange={(sort) => setFilters({ sort })}
            options={SORT_OPTIONS}
            value={search.sort}
          />
        </div>
      </FilterBar>
      <ListCard label="Hồ sơ được giao">{body}</ListCard>
    </div>
  )
}

export default MyApplicationList
