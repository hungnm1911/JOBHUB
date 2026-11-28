import { Link } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import { listAdminAccountsApi } from '@/apis/platform-admin.api'
import { USER_STATUS, USER_ROLE, COMPANY_MEMBER_ROLE } from '@/utils/constant'
import useAdminList from '../hooks/useAdminList'
import {
  AdminStatus,
  AdminState,
  AdminTable,
  AdminPager,
  AdminSelect,
  AdminToolbar,
} from './AdminUi'
const spec = {
  q: 'text',
  companyId: 'id',
  limit: ['20', '10', '50', '100'],
  sort: ['-createdAt', 'createdAt', 'fullName', '-fullName', 'email'],
  actorType: [
    '',
    USER_ROLE.CANDIDATE,
    COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
    COMPANY_MEMBER_ROLE.RECRUITER,
    USER_ROLE.PLATFORM_ADMIN,
  ],
  userStatus: ['', ...Object.values(USER_STATUS)],
}
function AdminAccounts() {
  const { search, setFilters, setPage, resource } = useAdminList(
    spec,
    listAdminAccountsApi,
  )
  const items = resource.data?.accounts ?? []
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tài khoản"
        description="Quản lý tài khoản trên nền tảng. Trạng thái User và membership được hiển thị riêng."
      />
      {search.companyId && (
        <p className="text-sm text-muted-foreground">
          Đang lọc theo Company: {search.companyId}{' '}
          <button
            className="text-primary"
            onClick={() => setFilters({ companyId: '' })}
          >
            Bỏ lọc
          </button>
        </p>
      )}
      <AdminToolbar {...{ search, setFilters }} reload={resource.reload}>
        <AdminSelect
          label="Vai trò"
          value={search.actorType}
          onChange={(actorType) => setFilters({ actorType })}
          options={[
            ['', 'Tất cả'],
            [USER_ROLE.CANDIDATE, 'Ứng viên'],
            [COMPANY_MEMBER_ROLE.COMPANY_MANAGER, 'Company Manager'],
            [COMPANY_MEMBER_ROLE.RECRUITER, 'Recruiter'],
            [USER_ROLE.PLATFORM_ADMIN, 'Platform Admin'],
          ]}
        />
        <AdminSelect
          label="Tài khoản"
          value={search.userStatus}
          onChange={(userStatus) => setFilters({ userStatus })}
          options={[
            ['', 'Mọi trạng thái'],
            ...Object.values(USER_STATUS).map((v) => [v, v]),
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
            ['-fullName', 'Tên Z–A'],
            ['email', 'Email A–Z'],
          ]}
        />
      </AdminToolbar>
      <AdminState resource={resource}>
        <AdminTable
          headers={[
            'Tài khoản',
            'Vai trò',
            'Trạng thái User',
            'Membership',
            'Chi tiết',
          ]}
          empty={!items.length}
        >
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-5 py-4">
                <p className="font-medium">{item.fullName}</p>
                <p className="text-xs text-muted-foreground">{item.email}</p>
              </td>
              <td className="px-5 py-4">
                <AdminStatus value={item.actorType} />
              </td>
              <td className="px-5 py-4">
                <AdminStatus value={item.status} />
              </td>
              <td className="px-5 py-4">
                <AdminStatus value={item.membership?.status} />
              </td>
              <td className="px-5 py-4">
                <Link
                  className="text-primary"
                  to={`/admin/accounts/${item.id}`}
                >
                  Xem →
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
export default AdminAccounts
