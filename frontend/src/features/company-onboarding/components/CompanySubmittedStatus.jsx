import {
  CircleAlert,
  CircleCheck,
  Hourglass,
  Info,
  LoaderCircle,
  LogIn,
  MailCheck,
  MousePointerClick,
  RotateCw,
} from 'lucide-react'
import { useState } from 'react'

import { resendApprovalConfirmationApi } from '@/apis/company.api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { API_ERROR_MESSAGE } from '@/utils/constant'

const NEXT_STEPS = [
  {
    icon: Hourglass,
    title: 'Chờ xét duyệt',
    description: 'Platform Admin xem xét đúng hồ sơ bạn đã gửi.',
  },
  {
    icon: MailCheck,
    title: 'Nhận email xác nhận',
    description: 'Khi hồ sơ được chấp thuận, JOBHUB gửi email chứa liên kết kích hoạt.',
  },
  {
    icon: MousePointerClick,
    title: 'Bấm link kích hoạt',
    description: 'Liên kết kích hoạt đồng thời tài khoản Company Manager và doanh nghiệp.',
  },
  {
    icon: LogIn,
    title: 'Đăng nhập và sử dụng hệ thống',
    description: 'Đăng xuất phiên onboarding hiện tại rồi đăng nhập lại.',
  },
]

const RESEND_RESULT_STYLE = Object.freeze({
  success: { icon: CircleCheck, className: 'border-primary/30 bg-primary/5 text-primary' },
  info: { icon: Info, className: 'border-border bg-secondary text-foreground' },
  error: { icon: CircleAlert, className: 'border-destructive/30 bg-destructive/5 text-destructive' },
})

function toResendResult(error) {
  const field = error.details?.field

  if (error.status === 409 && field === 'token') {
    return { type: 'info', message: API_ERROR_MESSAGE.APPROVAL_CONFIRMATION_STILL_VALID }
  }

  if (error.status === 409 && (field === 'approvalStatus' || field === 'status')) {
    return { type: 'info', message: API_ERROR_MESSAGE.APPROVAL_CONFIRMATION_NOT_AVAILABLE }
  }

  if (error.status === 503) {
    return { type: 'error', message: API_ERROR_MESSAGE.APPROVAL_CONFIRMATION_EMAIL_UNAVAILABLE }
  }

  return { type: 'error', message: error.message }
}

function CompanySubmittedStatus({ company, accountPanel }) {
  const [resending, setResending] = useState(false)
  const [resendResult, setResendResult] = useState(null)

  const handleResend = async () => {
    setResending(true)
    setResendResult(null)

    try {
      await resendApprovalConfirmationApi()
      setResendResult({
        type: 'success',
        message: 'Đã gửi lại email kích hoạt. Vui lòng kiểm tra hộp thư của bạn.',
      })
    } catch (error) {
      setResendResult(toResendResult(error))
    } finally {
      setResending(false)
    }
  }

  const resultStyle = resendResult ? RESEND_RESULT_STYLE[resendResult.type] : null
  const ResultIcon = resultStyle?.icon

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground ring-8 ring-primary/15">
            <Hourglass aria-hidden="true" className="size-9" />
          </span>
          <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            Hồ sơ đã được gửi xét duyệt
          </h1>
          <p className="max-w-lg text-pretty text-sm text-muted-foreground sm:text-base">
            {company?.name ? (
              <>
                Hồ sơ của <span className="font-semibold text-foreground">{company.name}</span>{' '}
                đang chờ JOBHUB xét duyệt.
              </>
            ) : (
              'Hồ sơ doanh nghiệp của bạn đã được gửi và không còn chỉnh sửa được.'
            )}{' '}
            Tài khoản sẽ ở trạng thái chờ kích hoạt cho tới khi bạn mở liên kết kích hoạt trong
            email.
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">
              Pending Activation
            </span>
            <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">
              Doanh nghiệp chưa hoạt động
            </span>
          </div>
        </div>

        <ol className="mt-8 grid gap-3 sm:grid-cols-2">
          {NEXT_STEPS.map((step, index) => {
            const Icon = step.icon

            return (
              <li
                className={cn(
                  'flex gap-3 rounded-xl p-4',
                  index === 0 ? 'bg-primary/10' : 'bg-secondary/60',
                )}
                key={step.title}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-primary">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    {index + 1}. {step.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {step.description}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      </section>

      <aside className="space-y-4">
        <div className="space-y-3 rounded-2xl border bg-card p-5">
          <p className="flex items-center gap-2 font-semibold">
            <MailCheck aria-hidden="true" className="size-5 text-primary" />
            Liên kết kích hoạt đã hết hạn?
          </p>
          <p className="text-sm text-muted-foreground">
            Nếu hồ sơ đã được chấp thuận nhưng liên kết trong email đã hết hạn, bạn có thể yêu
            cầu gửi lại email kích hoạt.
          </p>
          <Button
            className="h-11 w-full"
            disabled={resending}
            onClick={handleResend}
            type="button"
            variant="outline"
          >
            {resending ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <RotateCw aria-hidden="true" className="size-4" />
            )}
            Gửi lại email kích hoạt
          </Button>
          {resendResult && (
            <p
              className={cn(
                'flex gap-2 rounded-lg border px-3 py-2.5 text-sm',
                resultStyle.className,
              )}
              role={resendResult.type === 'error' ? 'alert' : 'status'}
            >
              <ResultIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {resendResult.message}
            </p>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5 text-sm">
          <p className="font-semibold">Đã kích hoạt qua email?</p>
          <p className="mt-1 text-muted-foreground">
            Đăng xuất bằng nút bên dưới rồi đăng nhập lại để bắt đầu sử dụng JOBHUB.
          </p>
        </div>

        {accountPanel}
      </aside>
    </div>
  )
}

export default CompanySubmittedStatus
