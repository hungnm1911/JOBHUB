import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import {
  listCompanyRegistrationsApi,
  getRegistrationSummaryApi,
} from '@/apis/platform-admin.api'
import {
  useListSearch,
  toListQuery,
  useDebouncedValue,
} from '@/features/recruiter-workspace/public'
import {
  AdminState,
  AdminTable,
  AdminPager,
  AdminSelect,
  AdminToolbar,
  useAdminResource,
} from '@/features/admin-management/public'
import {
  REGISTRATION_STAGE_META,
  REGISTRATION_STAGE_ORDER,
  formatDateTime,
} from '../utils'
import RegistrationStageBadge from './RegistrationStageBadge'
import { toRegistrationStage } from '../utils'
const spec = {
  q: 'text',
  limit: ['20', '10', '50', '100'],
  sort: ['-submittedAt', 'submittedAt', 'name', '-name'],
}
const stageFilters = {
  pending: { approvalStatus: 'PENDING' },
  awaitingConfirmation: {
    approvalStatus: 'APPROVED',
    operationalStatus: 'INACTIVE',
  },
  active: { operationalStatus: 'ACTIVE' },
  locked: { operationalStatus: 'LOCKED' },
  rejected: { approvalStatus: 'REJECTED' },
}
function CompanyRegistrationList({
  stage,
  onStageChange,
  detailPath,
  accountPanel,
}) {
  const { search, setFilters, setPage } = useListSearch(spec)
  const q = useDebouncedValue(search.q)
  const resource = useAdminResource(listCompanyRegistrationsApi, {
    ...toListQuery({ ...search, q }),
    ...stageFilters[stage],
  })
  const summary = useAdminResource(getRegistrationSummaryApi)
  const [, setParams] = useSearchParams()
  const items = resource.data?.companyRegistrations ?? []
  return (
    <div className="space-y-6">
      <PageHeader
        title="Xét duyệt doanh nghiệp"
        description="Hồ sơ được gửi theo snapshot; tìm theo doanh nghiệp, mã số hoặc Manager hiện tại."
        actions={accountPanel}
      />
      <div className="flex flex-wrap gap-2" aria-label="Lọc giai đoạn">
        {['all', ...REGISTRATION_STAGE_ORDER].map((key) => (
          <button
            aria-pressed={(stage ?? 'all') === key}
            className={`rounded-md border px-3 py-2 text-sm ${(stage ?? 'all') === key ? 'border-primary bg-primary/10 text-primary' : 'bg-card'}`}
            key={key}
            onClick={() => {
              setParams({})
              onStageChange(key === 'all' ? null : key)
            }}
            type="button"
          >
            {key === 'all' ? 'Tất cả' : REGISTRATION_STAGE_META[key].label}{' '}
            <span className="ml-1 text-xs">
              {summary.error
                ? '—'
                : (summary.data?.summary[key === 'all' ? 'total' : key] ?? '…')}
            </span>
          </button>
        ))}
      </div>
      <AdminToolbar
        search={search}
        setFilters={setFilters}
        reload={() => {
          resource.reload()
          summary.reload()
        }}
      >
        <AdminSelect
          label="Sắp xếp"
          value={search.sort}
          onChange={(sort) => setFilters({ sort })}
          options={[
            ['-submittedAt', 'Mới gửi nhất'],
            ['submittedAt', 'Chờ lâu nhất'],
            ['name', 'Tên A–Z'],
            ['-name', 'Tên Z–A'],
          ]}
        />
      </AdminToolbar>
      <AdminState resource={resource}>
        <AdminTable
          headers={[
            'Doanh nghiệp',
            'Manager đại diện',
            'Ngày gửi',
            'Trạng thái',
            'Chi tiết',
          ]}
          empty={!items.length}
        >
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-5 py-4 font-medium">
                {item.companyName}
                <p className="mt-1 text-xs font-normal text-muted-foreground">
                  {item.businessRegistrationNumber}
                </p>
              </td>
              <td className="px-5 py-4">
                {item.manager.fullName}
                <p className="text-xs text-muted-foreground">
                  {item.manager.email}
                </p>
              </td>
              <td className="px-5 py-4">{formatDateTime(item.submittedAt)}</td>
              <td className="px-5 py-4">
                <RegistrationStageBadge stage={toRegistrationStage(item)} />
              </td>
              <td className="px-5 py-4">
                <Link className="text-primary" to={detailPath(item.id)}>
                  Mở hồ sơ →
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
        <AdminPager
          pagination={resource.data?.pagination}
          onPageChange={setPage}
        />
      </AdminState>
    </div>
  )
}
export default CompanyRegistrationList
