import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'

function AdminStatus({ value, label }) {
  const labels = {
    ACTIVE: 'Hoạt động',
    LOCKED: 'Đã khóa',
    TERMINATED: 'Đã chấm dứt',
    PENDING_ACTIVATION: 'Chờ kích hoạt',
    NOT_SUBMITTED: 'Bản nháp',
    PENDING: 'Chờ duyệt',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Đã từ chối',
    INACTIVE: 'Chưa hoạt động',
    CANDIDATE: 'Ứng viên',
    COMPANY_MANAGER: 'Company Manager',
    RECRUITER: 'Recruiter',
    PLATFORM_ADMIN: 'Platform Admin',
    DRAFT: 'Bản nháp',
    PENDING_APPROVAL: 'Chờ duyệt',
    PUBLISHED: 'Đã xuất bản',
    CLOSED: 'Đã đóng',
    EXPIRED: 'Hết hạn',
    COMPLETE: 'Đã phân phối',
    APPLIED: 'Đã ứng tuyển',
    SCREENING: 'Sàng lọc',
    CONTACTED: 'Đã liên hệ',
    INTERVIEW_SCHEDULED: 'Đã lên lịch',
    INTERVIEW_COMPLETED: 'Đã phỏng vấn',
    HIRED: 'Đã tuyển',
    WITHDRAWN: 'Đã rút',
    UNRESOLVED: 'Chưa xác định',
  }
  const tone = ['LOCKED', 'TERMINATED', 'REJECTED'].includes(value)
    ? 'bg-destructive/10 text-destructive'
    : ['ACTIVE', 'APPROVED', 'COMPLETE', 'PUBLISHED'].includes(value)
      ? 'bg-primary/10 text-primary'
      : 'bg-secondary text-secondary-foreground'
  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${tone}`}
    >
      {label ?? labels[value] ?? value ?? '—'}
    </span>
  )
}
function AdminState({ resource, children }) {
  if (resource.loading)
    return (
      <p
        aria-live="polite"
        className="rounded-xl border bg-card p-8 text-muted-foreground"
      >
        Đang tải dữ liệu…
      </p>
    )
  if (resource.error)
    return (
      <div role="alert" className="space-y-3 rounded-xl border bg-card p-6">
        <p>{resource.error.message}</p>
        <Button onClick={resource.reload} variant="outline">
          Thử lại
        </Button>
      </div>
    )
  return children
}
function AdminTable({ headers, children, empty }) {
  return (
    <div
      aria-label="Bảng dữ liệu"
      className="overflow-x-auto rounded-xl border bg-card"
      tabIndex={0}
    >
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="border-b bg-secondary/60 text-xs text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th className="px-5 py-3 font-medium" key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {empty ? (
            <tr>
              <td
                className="px-5 py-12 text-center text-muted-foreground"
                colSpan={headers.length}
              >
                Chưa có kết quả phù hợp.
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  )
}
function AdminPager({ pagination, onPageChange }) {
  if (!pagination) return null
  const { page, total, totalPages } = pagination
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-muted-foreground">
      <span>
        {total} kết quả · Trang {page}/{totalPages || 0}
      </span>
      <nav aria-label="Phân trang" className="flex gap-2">
        <Button
          aria-label="Trang trước"
          disabled={page <= 1}
          onClick={() =>
            onPageChange(Math.min(page - 1, Math.max(totalPages, 1)))
          }
          size="sm"
          variant="outline"
        >
          <ChevronLeft className="size-4" />
          Trước
        </Button>
        <Button
          aria-label="Trang sau"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          size="sm"
          variant="outline"
        >
          Sau
          <ChevronRight className="size-4" />
        </Button>
      </nav>
    </div>
  )
}
function AdminSelect({ label, value, onChange, options }) {
  return (
    <label className="grid gap-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      <select
        className="h-10 max-w-full rounded-md border bg-card px-3 text-sm text-foreground"
        onChange={(e) => onChange(e.target.value)}
        value={value}
      >
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}
function AdminToolbar({ search, setFilters, reload, children }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
      <label className="grid min-w-0 flex-1 gap-1.5 text-xs text-muted-foreground">
        <span>Tìm kiếm</span>
        <Input
          aria-label="Tìm kiếm"
          maxLength={200}
          onChange={(e) => setFilters({ q: e.target.value })}
          placeholder="Nhập từ khóa…"
          value={search.q ?? ''}
        />
      </label>
      {children}
      <AdminSelect
        label="Mỗi trang"
        onChange={(limit) => setFilters({ limit })}
        options={['10', '20', '50', '100'].map((v) => [v, v])}
        value={search.limit ?? '20'}
      />
      <Button aria-label="Làm mới" onClick={reload} variant="outline">
        <RefreshCw aria-hidden="true" className="size-4" />
      </Button>
    </div>
  )
}
function AdminDetails({ items }) {
  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div className="min-w-0" key={label}>
          <dt className="mb-1 text-xs text-muted-foreground">{label}</dt>
          <dd className="break-words text-sm [overflow-wrap:anywhere]">
            {value ?? '—'}
          </dd>
        </div>
      ))}
    </dl>
  )
}
export {
  AdminStatus,
  AdminState,
  AdminTable,
  AdminPager,
  AdminSelect,
  AdminToolbar,
  AdminDetails,
}
