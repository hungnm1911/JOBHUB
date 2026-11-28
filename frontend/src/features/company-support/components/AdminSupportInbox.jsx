import { Link } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import { listSupportConversationsApi } from '@/apis/support.api'
import {
  AdminState,
  AdminTable,
  AdminPager,
  AdminToolbar,
} from '@/features/admin-management/public'
import {
  useListSearch,
  toListQuery,
  useDebouncedValue,
} from '@/features/recruiter-workspace/public'
import { useAdminResource } from '@/features/admin-management/public'
const spec = { q: 'text', limit: ['20', '10', '50', '100'] }
function AdminSupportInbox() {
  const { search, setFilters, setPage } = useListSearch(spec)
  const q = useDebouncedValue(search.q)
  const resource = useAdminResource(
    listSupportConversationsApi,
    toListQuery({ ...search, q }),
  )
  const items = resource.data?.conversations ?? []
  return (
    <div className="space-y-6">
      <PageHeader
        title="Hộp thư doanh nghiệp"
        description="Hội thoại hỗ trợ chung của đội Platform Admin với Company Manager."
        actions={
          <Link
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            to="/admin/companies"
          >
            Chọn doanh nghiệp để chat
          </Link>
        }
      />
      <AdminToolbar {...{ search, setFilters }} reload={resource.reload} />
      <AdminState resource={resource}>
        <AdminTable
          headers={['Doanh nghiệp', 'Tin nhắn gần nhất', 'Hội thoại']}
          empty={!items.length}
        >
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-5 py-4 font-medium">{item.companyName}</td>
              <td className="px-5 py-4">
                {new Date(item.lastMessageAt).toLocaleString('vi-VN')}
              </td>
              <td className="px-5 py-4">
                <Link
                  className="text-primary"
                  to={`/admin/support/${item.companyId}`}
                >
                  Mở hội thoại →
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
export default AdminSupportInbox
