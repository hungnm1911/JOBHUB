import { BriefcaseBusiness, SearchX } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { listManagedJobsApi } from '@/apis/recruiter-job.api'
import { ErrorState, ListSkeleton, Pager, StateMessage } from '@/components/common/ListStates'
import { Button } from '@/components/ui/button'
import { SelectDropdown } from '@/components/ui/select-dropdown'
import useCvCatalogOptions from '@/features/candidate-cvs/hooks/useCvCatalogOptions'
import { APPLICATION_STATUS_STYLE } from '@/features/candidate-dashboard/application-status-style'
import { APPLICATION_STATUS_LABEL } from '@/features/candidate-dashboard/utils'
import { EMPLOYMENT_TYPE_LABEL, formatSalary } from '@/features/job-discovery/utils'
import { JOB_STATUS } from '@/utils/constant'

import useDistrictNames from '../hooks/useDistrictNames'
import useListSearch, { toListQuery, useDebouncedValue } from '../hooks/useListSearch'
import useResource from '../hooks/useResource'
import {
  JOB_STATUS_LABEL,
  PIPELINE_STATUSES,
  formatDay,
  getEffectiveJobStatus,
} from '../utils'
import JobStatusBadge from './JobStatusBadge'
import { FilterBar, ListCard, SearchInput } from './Panel'

const SEARCH_SPEC = Object.freeze({
  q: 'text',
  status: ['', ...Object.values(JOB_STATUS)],
  sort: ['-createdAt', 'createdAt', 'title', '-title'],
})

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  ...Object.values(JOB_STATUS).map((status) => ({ value: status, label: JOB_STATUS_LABEL[status] })),
]

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Mới nhất' },
  { value: 'createdAt', label: 'Cũ nhất' },
  { value: 'title', label: 'Tiêu đề A–Z' },
  { value: '-title', label: 'Tiêu đề Z–A' },
]

function ManagedJobCard({ item, locationLabel }) {
  const { job } = item
  const facts = [
    locationLabel,
    EMPLOYMENT_TYPE_LABEL[job.employmentType],
    job.salary ? formatSalary(job.salary) : null,
  ].filter(Boolean)
  const counts = PIPELINE_STATUSES.filter((status) => item.countsByStatus?.[status] > 0)

  return (
    <li className="space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            className="font-semibold break-words outline-none hover:text-primary focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
            to={`/recruiter/jobs/${job.id}`}
          >
            {job.title || 'Chưa đặt tiêu đề'}
          </Link>
          {facts.length > 0 && <p className="mt-0.5 text-sm text-muted-foreground">{facts.join(' · ')}</p>}
        </div>
        <JobStatusBadge status={getEffectiveJobStatus(job)} />
      </div>

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {[
          ['Hồ sơ', item.applicationCount],
          ['Chưa phân công', item.unassignedCount],
          ['Người hỗ trợ', item.supportingRecruiterCount],
          ['Ngày tạo', formatDay(job.createdAt)],
          ['Hạn nộp', formatDay(job.applicationDeadline) ?? 'Chưa đặt'],
        ].map(([label, value]) => (
          <div className="flex gap-1.5" key={label}>
            <dt className="text-muted-foreground">{label}:</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {counts.length > 0 && (
        <ul aria-label="Hồ sơ theo trạng thái" className="flex flex-wrap gap-2">
          {counts.map((status) => (
            <li
              className={`rounded-md border px-2 py-0.5 text-xs ${APPLICATION_STATUS_STYLE[status].badge}`}
              key={status}
            >
              {APPLICATION_STATUS_LABEL[status]}:{' '}
              <span className="font-semibold tabular-nums">{item.countsByStatus[status]}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function ManagedJobList() {
  const { search, setFilters, setPage, reset } = useListSearch(SEARCH_SPEC)
  const keyword = useDebouncedValue(search.q)
  const query = useMemo(() => toListQuery({ ...search, q: keyword }), [search, keyword])
  const { data, loading, error, reload } = useResource(listManagedJobsApi, query)
  const catalogs = useCvCatalogOptions()
  const items = data?.managedJobs ?? []
  const districtNames = useDistrictNames(items.map((item) => item.job.location?.provinceCode).filter(Boolean))
  const provinceNames = new Map(catalogs.provinces.map((province) => [province.code, province.name]))
  const hasFilters = Boolean(search.q || search.status)

  const locationLabel = (location) =>
    location?.provinceCode
      ? [districtNames[location.provinceCode]?.[location.districtCode], provinceNames.get(location.provinceCode)]
          .filter(Boolean)
          .join(', ')
      : null

  let body
  if (loading) body = <ListSkeleton label="Đang tải danh sách Job" />
  else if (error) body = <ErrorState error={error} onRetry={reload} />
  else if (items.length === 0) {
    body = (
      <StateMessage
        action={
          hasFilters || search.page > 1 ? (
            <Button onClick={reset} size="sm" type="button" variant="outline">
              Xóa bộ lọc
            </Button>
          ) : null
        }
        description={
          hasFilters
            ? 'Không có Job nào khớp với bộ lọc.'
            : 'Job bạn tạo sẽ hiện ở đây, kể cả khi còn là bản nháp.'
        }
        icon={hasFilters ? SearchX : BriefcaseBusiness}
        title={hasFilters ? 'Không có kết quả' : 'Chưa có Job nào'}
      />
    )
  } else {
    body = (
      <>
        <ul className="divide-y">
          {items.map((item) => (
            <ManagedJobCard item={item} key={item.job.id} locationLabel={locationLabel(item.job.location)} />
          ))}
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
            options={STATUS_OPTIONS}
            value={search.status}
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
      <ListCard label="Job tôi phụ trách chính">{body}</ListCard>
    </div>
  )
}

export default ManagedJobList
