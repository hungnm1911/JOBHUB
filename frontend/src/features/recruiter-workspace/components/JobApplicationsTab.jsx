import { Inbox } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { listJobApplicationsApi } from '@/apis/recruiter-application.api'
import { getJobTeamApi } from '@/apis/recruiter-job.api'
import { ErrorState, ListSkeleton, Pager, StateMessage } from '@/components/common/ListStates'
import { Button } from '@/components/ui/button'
import { SelectDropdown } from '@/components/ui/select-dropdown'
import ApplicationStatusBadge from '@/features/candidate-dashboard/components/ApplicationStatusBadge'
import { APPLICATION_STATUS_LABEL } from '@/features/candidate-dashboard/utils'
import { APPLICATION_SOURCE } from '@/utils/constant'

import useListSearch, { toListQuery, useDebouncedValue } from '../hooks/useListSearch'
import useResource from '../hooks/useResource'
import { PIPELINE_STATUSES, SOURCE_OPTIONS, formatDay } from '../utils'
import { AssigneeChip, SourceChip } from './ApplicationChips'
import DataTable from './DataTable'
import { Avatar, FilterBar, ListCard, SearchInput } from './Panel'

const UNASSIGNED = 'NONE'
const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Nộp mới nhất' },
  { value: 'createdAt', label: 'Nộp cũ nhất' },
  { value: '-updatedAt', label: 'Mới cập nhật' },
  { value: 'updatedAt', label: 'Cập nhật cũ nhất' },
]
const SEARCH_SPEC = Object.freeze({
  q: 'text',
  status: ['', ...PIPELINE_STATUSES],
  source: ['', ...Object.values(APPLICATION_SOURCE)],
  assigneeCompanyMemberId: 'text',
  sort: SORT_OPTIONS.map((option) => option.value),
})

const loadApplications = ({ jobId, query }) => listJobApplicationsApi(jobId, query)
const loadTeamOrNull = (jobId) => getJobTeamApi(jobId).catch(() => null)

const toApplicationPath = (application) =>
  `/recruiter/jobs/${application.jobId}/applications/${application.id}`

const COLUMNS = [
  {
    header: 'Ứng viên',
    cell: (application) => (
      <Link
        className="flex min-w-48 items-center gap-3 rounded-sm font-semibold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        to={toApplicationPath(application)}
      >
        <Avatar person={application.candidate} />
        <span className="break-words">{application.candidate?.fullName ?? 'Ứng viên'}</span>
      </Link>
    ),
  },
  { header: 'Trạng thái', className: 'whitespace-nowrap', cell: (application) => <ApplicationStatusBadge status={application.status} /> },
  { header: 'Nguồn', className: 'whitespace-nowrap', cell: (application) => <SourceChip source={application.source} /> },
  { header: 'Người phụ trách', cell: (application) => <AssigneeChip recruiter={application.assignedRecruiter} /> },
  { header: 'Ngày nộp', className: 'whitespace-nowrap tabular-nums', cell: (application) => formatDay(application.appliedAt) },
  { header: 'Cập nhật', className: 'whitespace-nowrap tabular-nums', cell: (application) => formatDay(application.updatedAt) },
]

function JobApplicationsTab({ jobId }) {
  const { search, setFilters, setPage, reset } = useListSearch(SEARCH_SPEC)
  const keyword = useDebouncedValue(search.q)
  const params = useMemo(() => {
    const assignee = /^([a-fA-F0-9]{24}|NONE)$/.test(search.assigneeCompanyMemberId)
      ? search.assigneeCompanyMemberId
      : ''
    return { jobId, query: toListQuery({ ...search, q: keyword, assigneeCompanyMemberId: assignee }) }
  }, [jobId, search, keyword])
  const { data, loading, error, reload } = useResource(loadApplications, params)
  const team = useResource(loadTeamOrNull, jobId)
  const members = [
    team.data?.team?.primaryRecruiter,
    ...(team.data?.team?.supportingRecruiters ?? []),
  ].filter(Boolean)
  const hasFilters = Boolean(search.q || search.status || search.source || search.assigneeCompanyMemberId)

  let body
  if (loading) body = <ListSkeleton label="Đang tải hồ sơ" />
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
        description={hasFilters ? 'Không có hồ sơ nào khớp với bộ lọc.' : 'Job này chưa nhận được hồ sơ nào.'}
        icon={Inbox}
        title={hasFilters ? 'Không có kết quả' : 'Chưa có hồ sơ'}
      />
    )
  } else {
    body = (
      <>
        <DataTable
          columns={COLUMNS}
          label="Bảng ứng viên"
          rowKey={(application) => application.id}
          rowTo={toApplicationPath}
          rows={data.applications}
        />
        <Pager onPageChange={setPage} pagination={data.pagination} unit="hồ sơ" />
      </>
    )
  }

  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchInput label="Tìm theo tên ứng viên" onChange={(q) => setFilters({ q })} value={search.q} />
        <div className="grid gap-3 sm:grid-cols-2 lg:flex">
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
            ariaLabel="Lọc theo người xử lý"
            className="lg:w-44"
            onChange={(assigneeCompanyMemberId) => setFilters({ assigneeCompanyMemberId })}
            options={[
              { value: '', label: 'Mọi người xử lý' },
              { value: UNASSIGNED, label: 'Chưa phân công' },
              ...members.map((member) => ({ value: member.companyMemberId, label: member.fullName })),
            ]}
            value={search.assigneeCompanyMemberId}
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
      <ListCard label="Danh sách ứng viên">{body}</ListCard>
    </div>
  )
}

export default JobApplicationsTab
