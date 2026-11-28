import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  listAnnouncementsApi,
  getAnnouncementApi,
  publishAnnouncementApi,
} from '@/apis/platform-admin.api'
import PageHeader from '@/components/common/PageHeader'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/features/recruiter-workspace/public'
import { announcementSchema, zodResolver } from '@/validation'
import useAdminResource from '../hooks/useAdminResource'
import useAdminList from '../hooks/useAdminList'
import {
  AdminState,
  AdminTable,
  AdminPager,
  AdminToolbar,
  AdminStatus,
} from './AdminUi'
const spec = { q: 'text', limit: ['20', '10', '50', '100'] }
function AnnouncementProgress({ id, onComplete }) {
  const resource = useAdminResource(getAnnouncementApi, id)
  const item = resource.data?.announcement
  const { reload } = resource
  useEffect(() => {
    if (item?.status === 'COMPLETE') onComplete()
  }, [item?.status, onComplete])
  useEffect(() => {
    if (item?.status !== 'PENDING') return
    const timer = setInterval(reload, 5000)
    return () => clearInterval(timer)
  }, [item?.status, reload])
  return (
    <AdminState resource={resource}>
      {item && (
        <section className="space-y-4 rounded-xl border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">{item.title}</h2>
            <AdminStatus
              label={item.status === 'PENDING' ? 'Đang phân phối' : undefined}
              value={item.status}
            />
          </div>
          <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
            {item.content}
          </p>
          <p className="border-t pt-4 text-sm text-muted-foreground">
            Đã tạo inbox: {item.deliveredCount}/{item.totalRecipients} · Lỗi
            đang chờ thử lại: {item.failedCount}
          </p>
          {item.lastError && (
            <p role="status" className="text-sm text-destructive">
              {item.lastError}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Tiến độ thể hiện số inbox đã được lưu, không phải số người đã đọc.
          </p>
        </section>
      )}
    </AdminState>
  )
}
function AdminAnnouncements() {
  const { search, setFilters, setPage, resource } = useAdminList(
    spec,
    listAnnouncementsApi,
  )
  const form = useForm({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: '', content: '' },
  })
  const [draft, setDraft] = useState(null)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const logicalRequest = useRef(null)
  const preview = (event) =>
    form.handleSubmit((values) => {
      const fingerprint = JSON.stringify(values)
      if (logicalRequest.current?.fingerprint !== fingerprint)
        logicalRequest.current = {
          fingerprint,
          clientRequestId: crypto.randomUUID(),
        }
      setError('')
      setDraft({
        ...values,
        clientRequestId: logicalRequest.current.clientRequestId,
      })
    })(event)
  const publish = async () => {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    try {
      const result = await publishAnnouncementApi(draft)
      setSelected(result.announcement.id)
      setDraft(null)
      form.reset()
      logicalRequest.current = null
      resource.reload()
    } catch (failure) {
      setError(failure.message)
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  const items = resource.data?.announcements ?? []
  return (
    <div className="space-y-6">
      <PageHeader
        title="Thông báo hệ thống"
        description="Phát thông báo cho mọi tài khoản ACTIVE tại thời điểm gửi, trừ chính bạn."
      />
      <form
        className="space-y-4 rounded-xl border bg-card p-6"
        onSubmit={preview}
      >
        <h2 className="font-semibold">Soạn thông báo</h2>
        <label className="grid gap-2 text-sm">
          Tiêu đề
          <Input
            maxLength={160}
            {...form.register('title')}
            aria-invalid={!!form.formState.errors.title}
          />
        </label>
        {form.formState.errors.title && (
          <p className="text-sm text-destructive" role="alert">
            {form.formState.errors.title.message}
          </p>
        )}
        <label className="grid gap-2 text-sm">
          Nội dung
          <textarea
            className="min-h-32 rounded-md border bg-background p-3"
            maxLength={4000}
            {...form.register('content')}
            aria-invalid={!!form.formState.errors.content}
          />
        </label>
        {form.formState.errors.content && (
          <p className="text-sm text-destructive" role="alert">
            {form.formState.errors.content.message}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Nội dung sau phát hành không thể chỉnh sửa hoặc thu hồi. Người dùng
          offline sẽ nhận khi truy cập lại.
        </p>
        <Button type="submit">Xem trước và phát hành</Button>
      </form>
      {selected && (
        <AnnouncementProgress id={selected} key={selected} onComplete={resource.reload} />
      )}
      <h2 className="font-semibold">Lịch sử phát hành</h2>
      <AdminToolbar {...{ search, setFilters }} reload={resource.reload} />
      <AdminState resource={resource}>
        <AdminTable
          headers={['Tiêu đề', 'Phát hành', 'Inbox đã tạo', 'Trạng thái']}
          empty={!items.length}
        >
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-5 py-4">
                <button
                  className="text-left font-medium text-primary"
                  onClick={() => setSelected(item.id)}
                >
                  {item.title}
                </button>
              </td>
              <td className="px-5 py-4">
                {new Date(item.publishedAt).toLocaleString('vi-VN')}
              </td>
              <td className="px-5 py-4">
                {item.deliveredCount}/{item.totalRecipients}
              </td>
              <td className="px-5 py-4">
                <AdminStatus
                  label={
                    item.status === 'PENDING' ? 'Đang phân phối' : undefined
                  }
                  value={item.status}
                />
              </td>
            </tr>
          ))}
        </AdminTable>
        <AdminPager
          pagination={resource.data?.pagination}
          onPageChange={setPage}
        />
      </AdminState>
      <ConfirmDialog
        open={!!draft}
        title="Phát hành thông báo toàn hệ thống?"
        description="Tập người nhận sẽ được chốt khi phát hành. Không thể thu hồi hoặc sửa nội dung đã gửi."
        confirmLabel="Phát hành thông báo"
        busy={busy}
        onCancel={() => setDraft(null)}
        onConfirm={publish}
      >
        <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg bg-secondary p-4">
          <p className="font-semibold">{draft?.title}</p>
          <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
            {draft?.content}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </ConfirmDialog>
    </div>
  )
}
export default AdminAnnouncements
