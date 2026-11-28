import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import {
  getRegistrationSummaryApi,
  listCompanyRegistrationsApi,
} from '@/apis/platform-admin.api'
import {
  AdminState,
  AdminTable,
  useAdminResource,
} from '@/features/admin-management/public'
import {
  REGISTRATION_STAGE_META,
  REGISTRATION_STAGE_ORDER,
  formatDateTime,
} from '../utils'

function CompanyRegistrationOverview({ listPath, detailPath, accountPanel }) {
  const summary = useAdminResource(getRegistrationSummaryApi)
  const pending = useAdminResource(listCompanyRegistrationsApi, {
    approvalStatus: 'PENDING',
    sort: 'submittedAt',
    limit: 5,
  })
  const counts = summary.data?.summary
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bàn điều hành"
        description="Theo dõi hồ sơ doanh nghiệp và xử lý các tác vụ quản trị JOBHUB."
        actions={accountPanel}
      />
      <AdminState resource={summary}>
        {counts && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Link
              className="flex flex-col justify-between rounded-xl bg-hero p-6 text-hero-foreground"
              to={listPath('pending')}
            >
              <div>
                <p className="text-sm text-hero-muted">Đang chờ quyết định</p>
                <p className="my-3 text-5xl font-semibold">{counts.pending}</p>
                <p className="text-sm text-hero-muted">hồ sơ doanh nghiệp</p>
              </div>
              <span className="mt-6 flex items-center justify-between border-t border-hero-foreground/15 pt-4 text-sm">
                Đến hàng đợi xét duyệt
                <ArrowRight className="size-4" />
              </span>
            </Link>
            <div className="grid grid-cols-2 rounded-xl border bg-card lg:col-span-2">
              {REGISTRATION_STAGE_ORDER.filter((key) => key !== 'pending').map(
                (key) => (
                  <Link
                    className="space-y-2 border-b p-5 hover:bg-secondary"
                    key={key}
                    to={listPath(key)}
                  >
                    <p className="text-3xl font-semibold">{counts[key]}</p>
                    <p className="text-sm text-muted-foreground">
                      {REGISTRATION_STAGE_META[key].label}
                    </p>
                  </Link>
                ),
              )}
            </div>
          </div>
        )}
      </AdminState>
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Hồ sơ chờ lâu nhất</h2>
          <Link className="text-sm text-primary" to={listPath('pending')}>
            Xem tất cả →
          </Link>
        </div>
        <AdminState resource={pending}>
          <AdminTable
            headers={['Doanh nghiệp', 'Manager đại diện', 'Ngày gửi', 'Hồ sơ']}
            empty={!pending.data?.companyRegistrations.length}
          >
            {pending.data?.companyRegistrations.map((item) => (
              <tr key={item.id}>
                <td className="px-5 py-4">
                  <p className="font-medium">{item.companyName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.businessRegistrationNumber}
                  </p>
                </td>
                <td className="px-5 py-4">
                  {item.manager.fullName}
                  <p className="text-xs text-muted-foreground">
                    {item.manager.email}
                  </p>
                </td>
                <td className="px-5 py-4">
                  {formatDateTime(item.submittedAt)}
                </td>
                <td className="px-5 py-4">
                  <Link className="text-primary" to={detailPath(item.id)}>
                    Xét duyệt →
                  </Link>
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminState>
      </section>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          className="rounded-lg border bg-card px-4 py-3 text-primary"
          to="/admin/announcements"
        >
          Gửi thông báo hệ thống
        </Link>
        <Link
          className="rounded-lg border bg-card px-4 py-3 text-primary"
          to="/admin/support"
        >
          Hộp thư doanh nghiệp
        </Link>
        <Link
          className="rounded-lg border bg-card px-4 py-3 text-primary"
          to="/admin/statistics"
        >
          Xem thống kê nền tảng
        </Link>
      </div>
    </div>
  )
}
export default CompanyRegistrationOverview
