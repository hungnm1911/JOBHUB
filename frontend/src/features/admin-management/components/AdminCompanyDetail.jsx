import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAdminCompanyApi,
  listAdminRecruitersApi,
  lockAdminCompanyApi,
} from '@/apis/platform-admin.api'
import CompanyProfileCard from '@/components/common/CompanyProfileCard'
import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/features/recruiter-workspace/public'
import {
  USER_STATUS,
  COMPANY_MEMBER_STATUS,
  COMPANY_APPROVAL_STATUS,
  COMPANY_OPERATIONAL_STATUS,
} from '@/utils/constant'
import useAdminResource from '../hooks/useAdminResource'
import useAdminList from '../hooks/useAdminList'
import {
  AdminDetails,
  AdminState,
  AdminStatus,
  AdminTable,
  AdminToolbar,
  AdminSelect,
  AdminPager,
} from './AdminUi'
const spec = {
  q: 'text',
  limit: ['20', '10', '50', '100'],
  sort: ['-createdAt', 'createdAt', 'fullName', 'email'],
  userStatus: ['', ...Object.values(USER_STATUS)],
  membershipStatus: ['', ...Object.values(COMPANY_MEMBER_STATUS)],
}
function CompanyRecruiterList({ companyId }) {
  const { resource, search, setFilters, setPage } = useAdminList(
    spec,
    listAdminRecruitersApi,
    { companyId },
  )
  const items = resource.data?.recruiters ?? []
  return (
    <section className="space-y-4">
      <h2 className="font-semibold">Recruiter thuộc doanh nghiệp</h2>
      <AdminToolbar {...{ search, setFilters }} reload={resource.reload}>
        <AdminSelect
          label="Trạng thái User"
          value={search.userStatus}
          onChange={(userStatus) => setFilters({ userStatus })}
          options={[
            ['', 'Tất cả'],
            ...Object.values(USER_STATUS).map((v) => [v, v]),
          ]}
        />
        <AdminSelect
          label="Membership"
          value={search.membershipStatus}
          onChange={(membershipStatus) => setFilters({ membershipStatus })}
          options={[
            ['', 'Tất cả'],
            ...Object.values(COMPANY_MEMBER_STATUS).map((v) => [v, v]),
          ]}
        />
        <AdminSelect
          label="Sắp xếp"
          value={search.sort}
          onChange={(sort) => setFilters({ sort })}
          options={[
            ['-createdAt', 'Mới nhất'],
            ['createdAt', 'Cũ nhất'],
            ['fullName', 'Tên A–Z'],
            ['email', 'Email A–Z'],
          ]}
        />
      </AdminToolbar>
      <AdminState resource={resource}>
        <AdminTable
          headers={['Recruiter', 'Mã nhân viên', 'User', 'Membership']}
          empty={!items.length}
        >
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-5 py-4">
                <Link
                  className="text-primary"
                  to={`/admin/accounts/${item.id}`}
                >
                  {item.fullName}
                </Link>
                <p className="text-xs text-muted-foreground">{item.email}</p>
              </td>
              <td className="px-5 py-4">{item.membership.employeeCode}</td>
              <td className="px-5 py-4">
                <AdminStatus value={item.status} />
              </td>
              <td className="px-5 py-4">
                <AdminStatus value={item.membership.status} />
              </td>
            </tr>
          ))}
        </AdminTable>
        <AdminPager
          pagination={resource.data?.pagination}
          onPageChange={setPage}
        />
      </AdminState>
    </section>
  )
}
function AdminCompanyDetail({ companyId }) {
  const resource = useAdminResource(getAdminCompanyApi, companyId)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const submitting = useRef(false)
  const company = resource.data?.company
  const manager = resource.data?.manager
  const active =
    company?.approvalStatus === COMPANY_APPROVAL_STATUS.APPROVED &&
    company?.operationalStatus === COMPANY_OPERATIONAL_STATUS.ACTIVE
  const lock = async () => {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    try {
      await lockAdminCompanyApi(companyId)
      setNotice('Đã khóa doanh nghiệp và chấm dứt tài khoản Manager.')
      setConfirm(false)
      resource.reload()
    } catch (error) {
      setNotice(error.message)
      setConfirm(false)
      resource.reload()
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" to="/admin/companies">
        ← Doanh nghiệp
      </Link>
      <PageHeader
        title="Hồ sơ doanh nghiệp"
        description="Thông tin hiện tại; hồ sơ xét duyệt được lưu riêng theo snapshot."
        actions={
          company && (
            <Link
              className="rounded-md border bg-card px-4 py-2 text-sm text-primary"
              to={`/admin/support/${companyId}`}
            >
              Chat với doanh nghiệp
            </Link>
          )
        }
      />
      {notice && (
        <p className="rounded-lg border bg-secondary p-4 text-sm" role="status">
          {notice}
        </p>
      )}
      <AdminState resource={resource}>
        {company && (
          <>
            <div className="flex flex-wrap gap-2">
              <AdminStatus value={company.approvalStatus} />
              <AdminStatus value={company.operationalStatus} />
              {company.submittedAt && (
                <Link
                  className="ml-3 text-sm text-primary"
                  to={`/admin/company-registrations/${companyId}`}
                >
                  Xem hồ sơ xét duyệt →
                </Link>
              )}
            </div>
            <div className="rounded-xl border bg-card">
              <CompanyProfileCard profile={company} presentation="review" />
            </div>
            <section className="space-y-4 rounded-xl border bg-card p-6">
              <h2 className="font-semibold">Company Manager</h2>
              <AdminDetails
                items={[
                  [
                    'Đại diện',
                    <Link
                      className="text-primary"
                      to={`/admin/accounts/${manager.id}`}
                    >
                      {manager.fullName}
                    </Link>,
                  ],
                  ['Email', manager.email],
                  ['User', <AdminStatus value={manager.status} />],
                  [
                    'Tài khoản Company',
                    <Link
                      className="text-primary"
                      to={`/admin/accounts?companyId=${companyId}`}
                    >
                      Xem tất cả →
                    </Link>,
                  ],
                ]}
              />
            </section>
            <CompanyRecruiterList companyId={companyId} />
            {active && manager.status === USER_STATUS.ACTIVE && (
              <section className="space-y-3 rounded-xl border bg-card p-6">
                <h2 className="font-semibold">Vòng đời doanh nghiệp</h2>
                <p className="text-sm text-muted-foreground">
                  Khóa doanh nghiệp đồng thời chấm dứt Manager và thu hồi quyền
                  hoạt động. Không có thao tác mở khóa trong contract hiện tại.
                </p>
                <Button
                  disabled={busy || resource.refreshing}
                  onClick={() => setConfirm(true)}
                  variant="destructive"
                >
                  Khóa doanh nghiệp
                </Button>
              </section>
            )}
          </>
        )}
      </AdminState>
      <ConfirmDialog
        open={confirm}
        title="Khóa doanh nghiệp?"
        description="Company chuyển sang LOCKED, tài khoản Manager chuyển sang TERMINATED. Hành động không có API hoàn tác."
        confirmLabel="Khóa doanh nghiệp"
        destructive
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={lock}
      />
    </div>
  )
}
export default AdminCompanyDetail
