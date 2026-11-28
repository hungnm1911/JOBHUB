import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { getPlatformStatisticsApi } from '@/apis/platform-admin.api'
import useAdminResource from '../hooks/useAdminResource'
import { AdminState, AdminStatus } from './AdminUi'
function Breakdown({ title, values }) {
  const total = Object.values(values).reduce((a, b) => a + b, 0)
  return (
    <section className="space-y-4 rounded-xl border bg-card p-6">
      <h2 className="font-semibold">{title}</h2>
      <ul className="space-y-4">
        {Object.entries(values).map(([key, count]) => (
          <li className="space-y-2" key={key}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <AdminStatus value={key} />
              <span className="tabular-nums">
                {count.toLocaleString('vi-VN')}
              </span>
            </div>
            <meter
              aria-label={key}
              className="block h-2 w-full accent-primary"
              min="0"
              max={total || 1}
              value={count}
            >
              {count}
            </meter>
          </li>
        ))}
      </ul>
    </section>
  )
}
function AdminStatistics() {
  const resource = useAdminResource(getPlatformStatisticsApi)
  const stats = resource.data?.statistics
  return (
    <div className="space-y-6">
      <PageHeader
        title="Thống kê nền tảng"
        description="Số liệu tổng hợp hiện tại, bao gồm các bản ghi ở mọi trạng thái."
        actions={
          <Button
            disabled={resource.refreshing}
            onClick={resource.reload}
            variant="outline"
          >
            Làm mới
          </Button>
        }
      />
      <AdminState resource={resource}>
        {stats && (
          <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {[
                ['Tài khoản', stats.users.total],
                ['Doanh nghiệp', stats.companies.total],
                ['Job', stats.jobs.total],
                ['Application', stats.applications.total],
              ].map(([title, value]) => (
                <section className="rounded-xl border bg-card p-5" key={title}>
                  <h2 className="text-sm text-muted-foreground">{title}</h2>
                  <p className="mt-3 text-3xl font-semibold tabular-nums">
                    {value.toLocaleString('vi-VN')}
                  </p>
                </section>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Cập nhật: {new Date(stats.generatedAt).toLocaleString('vi-VN')}.
              Các nhóm được đọc độc lập; không phải snapshot giao dịch giữa mọi
              collection.
            </p>
            <div className="grid gap-5 lg:grid-cols-2">
              <Breakdown
                title="Trạng thái tài khoản"
                values={stats.users.byStatus}
              />
              <Breakdown
                title="Vai trò người dùng"
                values={stats.users.byActorType}
              />
              <Breakdown
                title="Phê duyệt doanh nghiệp"
                values={stats.companies.byApprovalStatus}
              />
              <Breakdown
                title="Hoạt động doanh nghiệp"
                values={stats.companies.byOperationalStatus}
              />
              <Breakdown title="Trạng thái Job" values={stats.jobs.byStatus} />
              <Breakdown
                title="Trạng thái Application"
                values={stats.applications.byStatus}
              />
            </div>
          </>
        )}
      </AdminState>
    </div>
  )
}
export default AdminStatistics
