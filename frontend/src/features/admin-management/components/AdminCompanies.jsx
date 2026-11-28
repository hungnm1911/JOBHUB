import { Link } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import { listAdminCompaniesApi } from '@/apis/platform-admin.api'
import {
  COMPANY_APPROVAL_STATUS,
  COMPANY_OPERATIONAL_STATUS,
} from '@/utils/constant'
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
  limit: ['20', '10', '50', '100'],
  sort: ['-createdAt', 'createdAt', 'name', '-name', '-updatedAt'],
  approvalStatus: ['', ...Object.values(COMPANY_APPROVAL_STATUS)],
  operationalStatus: ['', ...Object.values(COMPANY_OPERATIONAL_STATUS)],
}
function AdminCompanies() {
  const { search, setFilters, setPage, resource } = useAdminList(
    spec,
    listAdminCompaniesApi,
  )
  const items = resource.data?.companies ?? []
  return (
    <div className="space-y-6">
      <PageHeader
        title="Doanh nghiệp"
        description="Hồ sơ hiện tại của Company, gồm cả bản nháp chưa gửi xét duyệt."
      />
      <AdminToolbar {...{ search, setFilters }} reload={resource.reload}>
        <AdminSelect
          label="Phê duyệt"
          value={search.approvalStatus}
          onChange={(approvalStatus) => setFilters({ approvalStatus })}
          options={[
            ['', 'Tất cả'],
            ...Object.values(COMPANY_APPROVAL_STATUS).map((v) => [v, v]),
          ]}
        />
        <AdminSelect
          label="Hoạt động"
          value={search.operationalStatus}
          onChange={(operationalStatus) => setFilters({ operationalStatus })}
          options={[
            ['', 'Tất cả'],
            ...Object.values(COMPANY_OPERATIONAL_STATUS).map((v) => [v, v]),
          ]}
        />
        <AdminSelect
          label="Sắp xếp"
          value={search.sort}
          onChange={(sort) => setFilters({ sort })}
          options={[
            ['-createdAt', 'Mới nhất'],
            ['createdAt', 'Cũ nhất'],
            ['name', 'Tên A–Z'],
            ['-name', 'Tên Z–A'],
            ['-updatedAt', 'Mới cập nhật'],
          ]}
        />
      </AdminToolbar>
      <AdminState resource={resource}>
        <AdminTable
          headers={[
            'Doanh nghiệp',
            'Manager',
            'Phê duyệt',
            'Hoạt động',
            'Chi tiết',
          ]}
          empty={!items.length}
        >
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-5 py-4 font-medium">
                {item.name ?? 'Chưa đặt tên'}
                <p className="mt-1 text-xs font-normal text-muted-foreground">
                  {item.businessRegistrationNumber ?? 'Chưa có mã số'}
                </p>
              </td>
              <td className="px-5 py-4">
                {item.manager.fullName}
                <p className="text-xs text-muted-foreground">
                  {item.manager.email}
                </p>
              </td>
              <td className="px-5 py-4">
                <AdminStatus value={item.approvalStatus} />
              </td>
              <td className="px-5 py-4">
                <AdminStatus value={item.operationalStatus} />
              </td>
              <td className="px-5 py-4">
                <Link
                  className="text-primary"
                  to={`/admin/companies/${item.id}`}
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
export default AdminCompanies
