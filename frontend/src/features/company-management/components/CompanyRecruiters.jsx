import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { listCompanyRecruitersApi } from '@/apis/company-recruiter.api'
import {
  ErrorState,
  ListSkeleton,
  Pager,
  StateMessage,
} from '@/components/common/ListStates'
import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'
import {
  toListQuery,
  useDebouncedValue,
  useListSearch,
  useResource,
} from '@/features/recruiter-workspace/public'
import { COMPANY_MEMBER_STATUS } from '@/utils/constant'

import { recruiterReadiness } from '../utils'

const filters = {
  q: 'text',
  membershipStatus: ['', ...Object.values(COMPANY_MEMBER_STATUS)],
  sort: ['fullName', '-createdAt', 'createdAt', 'employeeCode'],
}

function CompanyRecruiters() {
  const { search, setFilters, setPage } = useListSearch(filters)
  const q = useDebouncedValue(search.q)
  const query = useMemo(() => toListQuery({ ...search, q }), [search, q])
  const { data, loading, error, reload } = useResource(
    listCompanyRecruitersApi,
    query,
  )
  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <Button asChild>
            <Link to="/company/recruiters/new">Tạo Recruiter</Link>
          </Button>
        }
        description="Quản lý tài khoản và tư cách nhân viên tuyển dụng của công ty."
        title="Recruiter"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>Tìm tên, email, mã nhân viên hoặc chức danh</span>
          <Input
            onChange={(e) => setFilters({ q: e.target.value })}
            type="search"
            value={search.q}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Trạng thái tại công ty</span>
          <select
            className="h-10 w-full rounded-md border bg-card px-3"
            onChange={(e) => setFilters({ membershipStatus: e.target.value })}
            value={search.membershipStatus}
          >
            <option value="">Tất cả trạng thái</option>
            <option value={COMPANY_MEMBER_STATUS.ACTIVE}>
              Active (gồm chờ kích hoạt)
            </option>
            <option value={COMPANY_MEMBER_STATUS.LOCKED}>Đang khóa</option>
            <option value={COMPANY_MEMBER_STATUS.TERMINATED}>
              Đã chấm dứt
            </option>
          </select>
        </label>
      </div>
      <section
        aria-label="Recruiter của công ty"
        className="rounded-xl border bg-card px-5"
      >
        {loading ? (
          <ListSkeleton label="Đang tải Recruiter" />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : data.recruiters.length === 0 ? (
          <StateMessage
            description="Tạo Recruiter đầu tiên hoặc thay đổi bộ lọc tìm kiếm."
            title="Chưa có Recruiter phù hợp"
          />
        ) : (
          <>
            <ul className="divide-y">
              {data.recruiters.map((recruiter) => (
                <li
                  className="flex flex-wrap items-start justify-between gap-3 py-5"
                  key={recruiter.id}
                >
                  <div className="min-w-0 space-y-1">
                    <Link
                      className="font-semibold break-words hover:text-primary"
                      to={`/company/recruiters/${recruiter.id}`}
                    >
                      {recruiter.fullName}
                    </Link>
                    <p className="text-sm break-all text-muted-foreground">
                      {recruiter.email}
                    </p>
                    <p className="text-sm break-words">
                      {recruiter.membership.employeeCode} ·{' '}
                      {recruiter.membership.jobTitle}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {recruiterReadiness(recruiter)}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/company/recruiters/${recruiter.id}`}>
                      Chi tiết
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
            <Pager
              onPageChange={setPage}
              pagination={data.pagination}
              unit="Recruiter"
            />
          </>
        )}
      </section>
    </div>
  )
}

export default CompanyRecruiters
