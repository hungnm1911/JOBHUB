import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAdminAccountApi,
  lockAdminAccountApi,
  terminateAdminAccountApi,
} from '@/apis/platform-admin.api'
import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/features/recruiter-workspace/public'
import useSessionViewer from '@/features/authentication/hooks/useSessionViewer'
import { USER_ROLE, COMPANY_MEMBER_ROLE, USER_STATUS } from '@/utils/constant'
import useAdminResource from '../hooks/useAdminResource'
import { AdminDetails, AdminState, AdminStatus } from './AdminUi'
function AdminAccountDetail({ userId }) {
  const resource = useAdminResource(getAdminAccountApi, userId)
  const viewer = useSessionViewer()
  const [action, setAction] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const submitting = useRef(false)
  const account = resource.data?.account
  const canManage =
    account &&
    account.id !== viewer.userId &&
    account.role !== USER_ROLE.PLATFORM_ADMIN &&
    account.membership?.role !== COMPANY_MEMBER_ROLE.COMPANY_MANAGER
  const mutate = async () => {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    try {
      await (
        action === 'lock' ? lockAdminAccountApi : terminateAdminAccountApi
      )(userId)
      setNotice(
        'Đã cập nhật trạng thái tài khoản. Các phiên truy cập bị thu hồi theo quy tắc hệ thống.',
      )
      setAction(null)
      resource.reload()
    } catch (error) {
      setNotice(error.message)
      resource.reload()
      setAction(null)
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" to="/admin/accounts">
        ← Tài khoản
      </Link>
      <PageHeader
        title={account?.fullName ?? 'Chi tiết tài khoản'}
        description={account?.email}
      />
      {notice && (
        <p className="rounded-lg border bg-secondary p-4 text-sm" role="status">
          {notice}
        </p>
      )}
      <AdminState resource={resource}>
        {account && (
          <>
            <section className="space-y-5 rounded-xl border bg-card p-6">
              <h2 className="font-semibold">Tài khoản nền tảng</h2>
              <AdminDetails
                items={[
                  ['Họ tên', account.fullName],
                  ['Email', account.email],
                  ['Vai trò', <AdminStatus value={account.actorType} />],
                  ['Trạng thái User', <AdminStatus value={account.status} />],
                  [
                    'Email xác thực',
                    account.emailVerifiedAt
                      ? new Date(account.emailVerifiedAt).toLocaleString(
                          'vi-VN',
                        )
                      : 'Chưa xác thực',
                  ],
                  [
                    'Thiết lập mật khẩu',
                    account.mustChangePassword ? 'Cần hoàn tất' : 'Đã hoàn tất',
                  ],
                ]}
              />
            </section>
            {account.membership && (
              <section className="space-y-5 rounded-xl border bg-card p-6">
                <h2 className="font-semibold">Membership doanh nghiệp</h2>
                <AdminDetails
                  items={[
                    [
                      'Vai trò trong Company',
                      <AdminStatus value={account.membership.role} />,
                    ],
                    [
                      'Trạng thái membership',
                      <AdminStatus value={account.membership.status} />,
                    ],
                    ['Mã nhân viên', account.membership.employeeCode],
                    ['Chức danh', account.membership.jobTitle],
                    [
                      'Company',
                      <Link
                        className="text-primary"
                        to={`/admin/companies/${account.membership.companyId}`}
                      >
                        Xem doanh nghiệp →
                      </Link>,
                    ],
                  ]}
                />
                <p className="text-sm text-muted-foreground">
                  Khóa User và khóa membership là hai trạng thái độc lập.
                </p>
              </section>
            )}
            {account.membership?.role ===
              COMPANY_MEMBER_ROLE.COMPANY_MANAGER && (
              <p className="rounded-lg border bg-card p-5 text-sm">
                Vòng đời Manager được quản lý qua{' '}
                <Link
                  className="text-primary"
                  to={`/admin/companies/${account.membership.companyId}`}
                >
                  doanh nghiệp
                </Link>
                .
              </p>
            )}
            {canManage && (
              <div className="flex flex-wrap gap-3">
                {account.status === USER_STATUS.ACTIVE && (
                  <Button
                    disabled={busy || resource.refreshing}
                    onClick={() => setAction('lock')}
                    variant="outline"
                  >
                    Khóa tài khoản
                  </Button>
                )}
                {[USER_STATUS.ACTIVE, USER_STATUS.LOCKED].includes(
                  account.status,
                ) && (
                  <Button
                    disabled={busy || resource.refreshing}
                    onClick={() => setAction('terminate')}
                    variant="destructive"
                  >
                    Chấm dứt tài khoản
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </AdminState>
      <ConfirmDialog
        open={!!action}
        title={action === 'lock' ? 'Khóa tài khoản?' : 'Chấm dứt tài khoản?'}
        description="Hành động thu hồi các phiên đăng nhập của User. Chấm dứt là quyết định không thể khôi phục qua API hiện tại."
        confirmLabel="Xác nhận"
        destructive
        busy={busy}
        onCancel={() => setAction(null)}
        onConfirm={mutate}
      />
    </div>
  )
}
export default AdminAccountDetail
