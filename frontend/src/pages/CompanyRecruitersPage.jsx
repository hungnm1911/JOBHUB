import { CircleX, LoaderCircle, MailCheck, RotateCw, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  createCompanyRecruiterApi,
  listCompanyRecruitersApi,
  resendRecruiterActivationApi,
} from '@/apis/company-recruiter.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'
import { formatDate } from '@/features/job-discovery/utils'
import { cn } from '@/lib/utils'
import { COMPANY_MEMBER_STATUS } from '@/utils/constant'

const EMPTY_FORM = Object.freeze({ fullName: '', email: '', employeeCode: '', jobTitle: '' })

const FIELDS = Object.freeze([
  { name: 'fullName', label: 'Họ và tên', placeholder: 'Ví dụ: Trần Thị Bình', autoComplete: 'off' },
  { name: 'email', label: 'Email công việc', placeholder: 'ten@congty.com', type: 'email', autoComplete: 'off' },
  { name: 'employeeCode', label: 'Mã nhân viên', placeholder: 'Ví dụ: NV002', autoComplete: 'off' },
  { name: 'jobTitle', label: 'Chức danh', placeholder: 'Ví dụ: Chuyên viên tuyển dụng', autoComplete: 'off' },
])

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(form) {
  const errors = {}
  for (const field of FIELDS) {
    const value = form[field.name].trim()
    if (!value) {
      errors[field.name] = `Vui lòng nhập ${field.label.toLowerCase()}.`
    } else if (value.length > (field.name === 'email' ? 320 : 100)) {
      errors[field.name] = `${field.label} quá dài.`
    }
  }
  if (!errors.email && !EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = 'Email không hợp lệ.'
  }
  return errors
}

// Backend messages are English; map the outcomes a Company Manager can act on.
function toCreateError(error) {
  const field = error?.details?.field
  if (error?.status === 409 && field === 'employeeCode') {
    return { employeeCode: 'Mã nhân viên này đã có trong công ty.' }
  }
  if (error?.status === 409) {
    return { email: 'Email này đã được dùng cho một tài khoản khác.' }
  }
  if (error?.status === 400 && FIELDS.some((item) => item.name === field)) {
    return { [field]: 'Giá trị không hợp lệ.' }
  }
  return null
}

function getRecruiterState(recruiter) {
  const status = recruiter.membership?.status
  if (status === COMPANY_MEMBER_STATUS.TERMINATED) {
    return { label: 'Đã chấm dứt', tone: 'border-border bg-muted text-muted-foreground' }
  }
  if (status === COMPANY_MEMBER_STATUS.LOCKED) {
    return { label: 'Đang khóa', tone: 'border-destructive/25 bg-destructive/5 text-destructive' }
  }
  if (recruiter.mustChangePassword) {
    return { label: 'Chờ kích hoạt', tone: 'border-warning/30 bg-warning/10 text-warning-foreground', pending: true }
  }
  return { label: 'Đang hoạt động', tone: 'border-success-foreground/20 bg-success text-success-foreground' }
}

function useCompanyRecruiters() {
  const [reloadKey, setReloadKey] = useState(0)
  const [view, setView] = useState({ key: null, recruiters: [], error: null })

  useEffect(() => {
    let active = true
    listCompanyRecruitersApi({ limit: 100 }).then(
      (data) => active && setView({ key: reloadKey, recruiters: data.recruiters ?? [], error: null }),
      (error) => active && setView({ key: reloadKey, recruiters: [], error }),
    )
    return () => {
      active = false
    }
  }, [reloadKey])

  return {
    loading: view.key !== reloadKey,
    recruiters: view.recruiters,
    error: view.error,
    reload: useCallback(() => setReloadKey((key) => key + 1), []),
  }
}

function CreateRecruiterForm({ onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const inputRefs = useRef({})

  const focusFirstError = (nextErrors) => {
    const first = FIELDS.find((field) => nextErrors[field.name])
    if (first) {
      inputRefs.current[first.name]?.focus()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors)
      return
    }

    setSubmitting(true)
    try {
      const payload = Object.fromEntries(FIELDS.map((field) => [field.name, form[field.name].trim()]))
      await createCompanyRecruiterApi(payload)
      toast.success('Đã tạo Recruiter', {
        description: `Email kích hoạt đã gửi tới ${payload.email}.`,
      })
      setForm(EMPTY_FORM)
      setErrors({})
      onCreated()
    } catch (error) {
      const fieldErrors = toCreateError(error)
      if (fieldErrors) {
        setErrors(fieldErrors)
        focusFirstError(fieldErrors)
      } else {
        toast.error(error?.status ? 'Không tạo được Recruiter. Vui lòng thử lại.' : error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      className="space-y-4 rounded-xl border bg-card p-5 shadow-xs sm:p-6"
      noValidate
      onSubmit={handleSubmit}
    >
      <div>
        <h2 className="text-base font-semibold">Tạo tài khoản Recruiter</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Recruiter nhận email kích hoạt và tự đặt mật khẩu. Bạn không biết mật khẩu của họ.
        </p>
      </div>

      {FIELDS.map((field) => {
        const id = `recruiter-${field.name}`
        const error = errors[field.name]
        return (
          <div className="space-y-1.5" key={field.name}>
            <label className="block text-sm font-medium" htmlFor={id}>
              {field.label}
            </label>
            <Input
              aria-describedby={`${id}-hint`}
              aria-invalid={Boolean(error)}
              autoComplete={field.autoComplete}
              id={id}
              name={field.name}
              onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
              placeholder={field.placeholder}
              ref={(node) => {
                inputRefs.current[field.name] = node
              }}
              type={field.type ?? 'text'}
              value={form[field.name]}
            />
            <p className="min-h-[1lh] text-xs text-destructive" id={`${id}-hint`} role={error ? 'alert' : undefined}>
              {error ?? ''}
            </p>
          </div>
        )
      })}

      <Button aria-busy={submitting} className="w-full" disabled={submitting} type="submit">
        {submitting ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <UserPlus aria-hidden="true" className="size-4" />
        )}
        {submitting ? 'Đang tạo và gửi email…' : 'Tạo và gửi email kích hoạt'}
      </Button>
    </form>
  )
}

function RecruiterTable({ recruiters, loading, error, onRetry }) {
  const [resendingId, setResendingId] = useState(null)

  const resend = async (recruiter) => {
    setResendingId(recruiter.id)
    try {
      await resendRecruiterActivationApi(recruiter.id)
      toast.success('Đã gửi lại email kích hoạt', { description: recruiter.email })
    } catch (resendError) {
      toast.error(resendError?.status ? 'Không gửi lại được email kích hoạt.' : resendError.message)
    } finally {
      setResendingId(null)
    }
  }

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Đang tải danh sách Recruiter" className="divide-y" role="status">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="space-y-2 py-4" key={index}>
            <div className="h-4 w-1/3 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-start gap-3 border-b py-8">
        <CircleX aria-hidden="true" className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Không tải được danh sách Recruiter.</p>
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          <RotateCw aria-hidden="true" className="size-4" />
          Tải lại
        </Button>
      </div>
    )
  }

  if (recruiters.length === 0) {
    return (
      <p className="border-b py-8 text-sm text-muted-foreground">
        Công ty chưa có Recruiter nào. Tạo tài khoản đầu tiên bằng form bên cạnh.
      </p>
    )
  }

  return (
    <ul className="divide-y border-y">
      {recruiters.map((recruiter) => {
        const state = getRecruiterState(recruiter)
        return (
          <li className="flex flex-wrap items-start justify-between gap-3 py-4" key={recruiter.id}>
            <div className="min-w-0 space-y-1">
              <p className="font-semibold break-words">{recruiter.fullName}</p>
              <p className="text-sm break-all text-muted-foreground">{recruiter.email}</p>
              <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">Mã:</dt>
                  <dd>{recruiter.membership?.employeeCode}</dd>
                </div>
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">Chức danh:</dt>
                  <dd>{recruiter.membership?.jobTitle}</dd>
                </div>
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">Ngày tạo:</dt>
                  <dd className="tabular-nums">{formatDate(recruiter.createdAt)}</dd>
                </div>
              </dl>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
                  state.tone,
                )}
              >
                {state.label}
              </span>
              {state.pending && (
                <Button
                  aria-busy={resendingId === recruiter.id}
                  disabled={resendingId === recruiter.id}
                  onClick={() => resend(recruiter)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {resendingId === recruiter.id ? (
                    <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <MailCheck aria-hidden="true" className="size-4" />
                  )}
                  Gửi lại email
                </Button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// Temporary Company Manager screen: create Recruiters and see their activation state.
function CompanyRecruitersPage() {
  const { recruiters, loading, error, reload } = useCompanyRecruiters()

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quản lý Recruiter</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tạo tài khoản cho nhân viên tuyển dụng của công ty.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <CreateRecruiterForm onCreated={reload} />
        <div className="min-w-0 space-y-3">
          <h2 className="text-base font-semibold">
            Recruiter của công ty{!loading && !error ? ` (${recruiters.length})` : ''}
          </h2>
          <RecruiterTable error={error} loading={loading} onRetry={reload} recruiters={recruiters} />
        </div>
      </div>
    </section>
  )
}

export default CompanyRecruitersPage
