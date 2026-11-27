import { useMemo, useState } from 'react'

import { listJobApplicationsApi } from '@/apis/recruiter-application.api'
import {
  ErrorState,
  ListSkeleton,
  Pager,
  StateMessage,
} from '@/components/common/ListStates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'
import { selectMembership } from '@/features/authentication/slice'
import { ApplicationStatusBadge } from '@/features/candidate-dashboard/public'
import {
  AssignmentPanel,
  formatDay,
  TERMINAL_STATUSES,
  toListQuery,
  useDebouncedValue,
  useListSearch,
  useResource,
} from '@/features/recruiter-workspace/public'
import { useAppSelector } from '@/store/hooks'
import { APPLICATION_SOURCE, APPLICATION_STATUS } from '@/utils/constant'

const filters = {
  q: 'text',
  status: ['', ...Object.values(APPLICATION_STATUS)],
  assigneeCompanyMemberId: ['', 'NONE'],
}
const loadApplications = ({ jobId, query }) =>
  listJobApplicationsApi(jobId, query)

function CompanyJobApplications({ job }) {
  const { search, setFilters, setPage } = useListSearch(filters)
  const keyword = useDebouncedValue(search.q)
  const params = useMemo(
    () => ({ jobId: job.id, query: toListQuery({ ...search, q: keyword }) }),
    [job.id, search, keyword],
  )
  const resource = useResource(loadApplications, params)
  const membership = useAppSelector(selectMembership)
  const [expanded, setExpanded] = useState(null)
  const [notice, setNotice] = useState('')
  return (
    <div className="space-y-4">
      <p className="rounded-lg border bg-card p-4 text-sm">
        Phân công người phụ trách cho từng hồ sơ. Recruiter được giao sẽ tiếp
        tục xử lý từ trạng thái tuyển dụng hiện tại.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>Tìm tên ứng viên</span>
          <Input
            onChange={(e) => setFilters({ q: e.target.value })}
            type="search"
            value={search.q}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Phân công</span>
          <select
            className="h-10 w-full rounded-md border bg-card px-3"
            onChange={(e) =>
              setFilters({ assigneeCompanyMemberId: e.target.value })
            }
            value={search.assigneeCompanyMemberId}
          >
            <option value="">Tất cả hồ sơ</option>
            <option value="NONE">Chưa phân công</option>
          </select>
        </label>
      </div>
      {notice && (
        <p className="text-sm" role="status">
          {notice}
        </p>
      )}
      <section className="rounded-xl border bg-card px-5">
        {resource.loading ? (
          <ListSkeleton label="Đang tải hồ sơ" />
        ) : resource.error ? (
          <ErrorState error={resource.error} onRetry={resource.reload} />
        ) : resource.data.applications.length === 0 ? (
          <StateMessage title="Chưa có hồ sơ phù hợp" />
        ) : (
          <>
            <ul className="divide-y">
              {resource.data.applications.map((application) => (
                <li className="space-y-4 py-5" key={application.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <h2 className="font-semibold break-words">
                        {application.candidate?.fullName ?? 'Ứng viên'}
                      </h2>
                      <ApplicationStatusBadge status={application.status} />
                      <p className="text-sm text-muted-foreground">
                        {application.source ===
                        APPLICATION_SOURCE.RECRUITER_INVITATION
                          ? 'Từ lời mời tuyển dụng'
                          : 'Ứng tuyển trực tiếp'}{' '}
                        · {formatDay(application.appliedAt)}
                      </p>
                      <p className="text-sm">
                        Phụ trách:{' '}
                        {application.assignedRecruiterCompanyMemberId
                          ? application.assignedRecruiter?.fullName ??
                            'Thành viên đã được giao'
                          : 'Chưa phân công'}
                      </p>
                    </div>
                    {!TERMINAL_STATUSES.includes(application.status) ? (
                      <Button
                        disabled={resource.refreshing}
                        onClick={() =>
                          setExpanded(
                            expanded === application.id ? null : application.id,
                          )
                        }
                        size="sm"
                        variant="outline"
                      >
                        {expanded === application.id
                          ? 'Thu gọn'
                          : 'Quản lý phân công'}
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Hồ sơ đã kết thúc
                      </span>
                    )}
                  </div>
                  {expanded === application.id && (
                    <AssignmentPanel
                      allowProcessing={false}
                      application={application}
                      disabled={resource.refreshing}
                      job={job}
                      membershipId={membership?.id}
                      onChanged={() => {
                        setExpanded(null)
                        setNotice(
                          'Đã tải lại trạng thái hồ sơ. Kiểm tra dữ liệu hiện tại trước khi phân công tiếp.',
                        )
                        resource.reload()
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
            <Pager
              onPageChange={setPage}
              pagination={resource.data.pagination}
              unit="hồ sơ"
            />
          </>
        )}
      </section>
    </div>
  )
}

export default CompanyJobApplications
