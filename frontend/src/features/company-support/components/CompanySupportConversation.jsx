import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import {
  getSupportMessagesApi,
  sendSupportMessageApi,
} from '@/apis/support.api'
import {
  useAdminResource,
  AdminState,
  AdminPager,
} from '@/features/admin-management/public'
import { supportMessageSchema, zodResolver } from '@/validation'
import {
  COMPANY_APPROVAL_STATUS,
  COMPANY_OPERATIONAL_STATUS,
} from '@/utils/constant'
function CompanySupportConversation({ companyId, isAdmin = false }) {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const q = params.get('q')?.trim().slice(0, 200) ?? ''
  const resource = useAdminResource(getSupportMessagesApi, {
    companyId,
    page,
    limit: 20,
    ...(q ? { q } : {}),
  })
  const form = useForm({
    resolver: zodResolver(supportMessageSchema),
    defaultValues: { content: '' },
  })
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const logicalRequest = useRef(null)
  const end = useRef(null)
  const data = resource.data
  const writable =
    data?.company.approvalStatus === COMPANY_APPROVAL_STATUS.APPROVED &&
    data?.company.operationalStatus === COMPANY_OPERATIONAL_STATUS.ACTIVE
  useEffect(() => {
    if (page === 1 && !q) end.current?.scrollIntoView({ block: 'nearest' })
  }, [data?.messages.length, page, q])
  const send = (event) =>
    form.handleSubmit(async ({ content }) => {
      if (submitting.current) return
      submitting.current = true
      setError('')
      if (logicalRequest.current?.content !== content)
        logicalRequest.current = {
          content,
          clientRequestId: crypto.randomUUID(),
        }
      try {
        await sendSupportMessageApi({ companyId, ...logicalRequest.current })
        logicalRequest.current = null
        form.reset()
        setParams({})
        resource.reload()
      } catch (failure) {
        setError(failure.message)
        resource.reload()
      } finally {
        submitting.current = false
      }
    })(event)
  return (
    <div className="space-y-5">
      {isAdmin && (
        <Link className="text-sm text-primary" to="/admin/support">
          ← Hộp thư doanh nghiệp
        </Link>
      )}
      <PageHeader
        title={
          isAdmin
            ? (data?.company.name ?? 'Hỗ trợ doanh nghiệp')
            : 'Hỗ trợ từ JOBHUB'
        }
        description="Trao đổi giữa Company Manager và đội quản trị nền tảng."
      />
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const text = new FormData(e.currentTarget).get('q').trim()
          setParams(text ? { q: text } : {})
        }}
      >
        <label className="flex flex-1 items-center gap-2 text-sm">
          Tìm tin nhắn
          <input
            aria-label="Tìm tin nhắn"
            className="h-10 min-w-0 flex-1 rounded-md border bg-card px-3"
            defaultValue={q}
            key={q}
            maxLength={200}
            name="q"
          />
        </label>
        <Button type="submit" variant="outline">
          Tìm
        </Button>
        {q && (
          <Button onClick={() => setParams({})} variant="outline">
            Xóa tìm kiếm
          </Button>
        )}
        <Button onClick={resource.reload} variant="outline">
          Làm mới
        </Button>
      </form>
      <AdminState resource={resource}>
        <section
          aria-label="Tin nhắn hỗ trợ"
          className="space-y-4 rounded-xl border bg-card p-4 sm:p-6"
        >
          <p className="border-b pb-4 text-xs text-muted-foreground">
            {isAdmin
              ? 'Hội thoại chung của đội Platform Admin'
              : 'Đại diện doanh nghiệp: Company Manager'}{' '}
            · Tin nhắn được lưu lâu dài
          </p>
          <ol className="max-h-[520px] space-y-5 overflow-y-auto" tabIndex={0}>
            {[...(data?.messages ?? [])].reverse().map((item) => (
              <li
                className={`max-w-[90%] rounded-lg p-4 ${item.senderRole === 'PLATFORM_ADMIN' ? 'ml-auto bg-primary/10' : 'bg-secondary'}`}
                key={item.id}
              >
                <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <strong className="font-medium text-foreground">
                    {item.senderName} ·{' '}
                    {item.senderRole === 'PLATFORM_ADMIN'
                      ? 'JOBHUB'
                      : 'Company Manager'}
                  </strong>
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString('vi-VN')}
                  </time>
                </div>
                <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                  {item.content}
                </p>
              </li>
            ))}
            <li aria-hidden="true" ref={end} />
          </ol>
          {!data?.messages.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {q
                ? 'Không tìm thấy tin nhắn.'
                : 'Chưa có tin nhắn. Bắt đầu trao đổi với nội dung bên dưới.'}
            </p>
          )}
          <AdminPager
            pagination={data?.pagination}
            onPageChange={(next) =>
              setParams({ ...(q ? { q } : {}), page: next })
            }
          />
        </section>
      </AdminState>
      {error && (
        <p
          className="rounded-lg border bg-destructive/5 p-4 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      {writable ? (
        <form
          className="space-y-3 rounded-xl border bg-card p-4"
          onSubmit={send}
        >
          <label className="grid gap-2 text-sm">
            Tin nhắn
            <textarea
              aria-invalid={!!form.formState.errors.content}
              className="min-h-24 rounded-md border p-3"
              maxLength={4000}
              disabled={form.formState.isSubmitting}
              {...form.register('content')}
            />
          </label>
          {form.formState.errors.content && (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.content.message}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              Chỉ hỗ trợ tin nhắn văn bản.
            </span>
            <Button
              disabled={form.formState.isSubmitting || resource.refreshing}
              type="submit"
            >
              {form.formState.isSubmitting ? 'Đang gửi…' : 'Gửi tin nhắn'}
            </Button>
          </div>
        </form>
      ) : (
        data && (
          <p className="rounded-lg border bg-secondary p-4 text-sm">
            Hội thoại hiện chỉ đọc do trạng thái doanh nghiệp.
          </p>
        )
      )}
    </div>
  )
}
export default CompanySupportConversation
