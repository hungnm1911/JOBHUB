import {
  ArrowRight,
  Building2,
  CircleCheck,
  CircleX,
  House,
  Info,
  LoaderCircle,
  RotateCw,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { confirmCompanyApprovalApi } from '@/apis/authentication.api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { endSessionOfActivatedUser } from '../services/authentication.service'

const CONFIRMATION_STATE = Object.freeze({
  CONFIRMING: 'confirming',
  CONFIRMED: 'confirmed',
  INVALID_TOKEN: 'invalidToken',
  NOT_APPLICABLE: 'notApplicable',
  FAILED: 'failed',
})

// Confirmation tokens are single-use; React StrictMode re-runs effects in
// development, so concurrent calls for the same token share one request.
const pendingConfirmations = new Map()

function confirmOnce(token) {
  if (!pendingConfirmations.has(token)) {
    const request = confirmCompanyApprovalApi({ token })
      .then(async (response) => {
        await endSessionOfActivatedUser(response.user?.id)
        return response
      })
      .finally(() => {
        pendingConfirmations.delete(token)
      })
    pendingConfirmations.set(token, request)
  }

  return pendingConfirmations.get(token)
}

function toConfirmationState(error) {
  if (error.status === 400 && error.details?.field === 'token') {
    return CONFIRMATION_STATE.INVALID_TOKEN
  }

  if (error.status === 409) {
    return CONFIRMATION_STATE.NOT_APPLICABLE
  }

  return CONFIRMATION_STATE.FAILED
}

function ResultHeader({ icon: Icon, tone, eyebrow, title, description, spinning = false }) {
  return (
    <div className="flex items-start gap-4">
      <span
        className={cn('flex size-14 shrink-0 items-center justify-center rounded-full ring-8', tone)}
      >
        <Icon aria-hidden="true" className={cn('size-7', spinning && 'animate-spin')} />
      </span>
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
        )}
        <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-pretty text-sm text-muted-foreground sm:text-base">{description}</p>
      </div>
    </div>
  )
}

function StatusSummary({ user, company }) {
  const rows = [
    { icon: Building2, label: 'Doanh nghiệp', value: company?.name, status: 'Đang hoạt động' },
    { icon: UserRoundCheck, label: 'Company Manager', value: user?.email, status: 'Đã kích hoạt' },
    { icon: ShieldCheck, label: 'Phê duyệt', value: 'Platform Admin', status: 'Đã phê duyệt' },
  ]

  return (
    <div className="rounded-xl border bg-secondary/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Tóm tắt trạng thái
      </p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        {rows.map((row) => {
          const Icon = row.icon

          return (
            <div className="min-w-0 rounded-lg bg-card p-3" key={row.label}>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon aria-hidden="true" className="size-3.5" />
                {row.label}
              </dt>
              <dd className="mt-1 truncate text-sm font-semibold">{row.value ?? '—'}</dd>
              <dd className="mt-1.5 w-fit rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {row.status}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

function Notice({ children }) {
  return (
    <div className="flex gap-3 rounded-xl bg-primary/5 p-4 text-sm">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
      <p className="text-muted-foreground">{children}</p>
    </div>
  )
}

function LoginActions({ email }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <Button asChild className="h-11">
        <Link replace state={email ? { registeredEmail: email } : null} to="/login">
          Đăng nhập vào JOBHUB
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </Button>
      <Button asChild className="h-11" variant="outline">
        <Link to="/">
          <House aria-hidden="true" className="size-4" />
          Về trang chủ
        </Link>
      </Button>
    </div>
  )
}

function CompanyApprovalConfirmationResult({ token }) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ attempt: -1, state: null, user: null, company: null })
  const state = !token
    ? CONFIRMATION_STATE.INVALID_TOKEN
    : result.attempt === attempt
      ? result.state
      : CONFIRMATION_STATE.CONFIRMING

  useEffect(() => {
    if (!token) {
      return
    }

    let active = true

    confirmOnce(token).then(
      (response) => {
        if (active) {
          setResult({
            attempt,
            state: CONFIRMATION_STATE.CONFIRMED,
            user: response.user,
            company: response.company,
          })
        }
      },
      (error) => {
        if (active) {
          setResult({ attempt, state: toConfirmationState(error), user: null, company: null })
        }
      },
    )

    return () => {
      active = false
    }
  }, [attempt, token])

  return (
    <div aria-live="polite" className="flex flex-col gap-6">
      {state === CONFIRMATION_STATE.CONFIRMING && (
        <ResultHeader
          description="Vui lòng chờ trong giây lát, JOBHUB đang kích hoạt tài khoản và doanh nghiệp của bạn."
          icon={LoaderCircle}
          spinning
          title="Đang xác nhận kích hoạt…"
          tone="bg-primary/10 text-primary ring-primary/5"
        />
      )}

      {state === CONFIRMATION_STATE.CONFIRMED && (
        <>
          <ResultHeader
            description="Bạn đã hoàn tất quy trình onboarding doanh nghiệp trên JOBHUB. Tài khoản Company Manager và doanh nghiệp của bạn đã được kích hoạt."
            eyebrow="Kích hoạt hoàn tất"
            icon={CircleCheck}
            title="Doanh nghiệp đã được kích hoạt"
            tone="bg-primary text-primary-foreground ring-primary/15"
          />
          <StatusSummary company={result.company} user={result.user} />
          <Notice>
            Đăng nhập bằng{' '}
            {result.user?.email ? (
              <span className="font-semibold text-foreground">{result.user.email}</span>
            ) : (
              'email'
            )}{' '}
            và mật khẩu đã đăng ký để bắt đầu sử dụng JOBHUB.
          </Notice>
          <LoginActions email={result.user?.email} />
        </>
      )}

      {state === CONFIRMATION_STATE.INVALID_TOKEN && (
        <>
          <ResultHeader
            description="Liên kết kích hoạt không hợp lệ, đã hết hạn hoặc đã được sử dụng. Mỗi liên kết chỉ dùng được một lần trong thời hạn hiệu lực."
            icon={CircleX}
            title="Liên kết không còn hiệu lực"
            tone="bg-destructive/10 text-destructive ring-destructive/5"
          />
          <Notice>
            Nếu bạn đã kích hoạt trước đó, hãy đăng nhập như bình thường. Nếu liên kết đã hết
            hạn, hãy đăng nhập và yêu cầu gửi lại email kích hoạt trong màn hình onboarding.
          </Notice>
          <LoginActions />
        </>
      )}

      {state === CONFIRMATION_STATE.NOT_APPLICABLE && (
        <>
          <ResultHeader
            description="Tài khoản hoặc doanh nghiệp không còn ở trạng thái chờ kích hoạt, nên liên kết này không thể sử dụng."
            icon={Info}
            title="Không thể kích hoạt bằng liên kết này"
            tone="bg-secondary text-foreground ring-secondary/60"
          />
          <LoginActions />
        </>
      )}

      {state === CONFIRMATION_STATE.FAILED && (
        <>
          <ResultHeader
            description="Không thể xác nhận kích hoạt lúc này. Vui lòng kiểm tra kết nối và thử lại."
            icon={CircleX}
            title="Kích hoạt chưa hoàn tất"
            tone="bg-destructive/10 text-destructive ring-destructive/5"
          />
          <div>
            <Button onClick={() => setAttempt((current) => current + 1)} type="button">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export default CompanyApprovalConfirmationResult
