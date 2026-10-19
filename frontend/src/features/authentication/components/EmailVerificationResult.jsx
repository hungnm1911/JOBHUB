import {
  ArrowRight,
  CircleCheck,
  CircleX,
  Info,
  LoaderCircle,
  LogIn,
  MailCheck,
  RotateCw,
  UserRoundPlus,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { verifyEmailApi } from '@/apis/authentication.api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const VERIFICATION_STATE = Object.freeze({
  VERIFYING: 'verifying',
  VERIFIED: 'verified',
  ALREADY_VERIFIED: 'alreadyVerified',
  INVALID_TOKEN: 'invalidToken',
  FAILED: 'failed',
})

const STEP_STATE = Object.freeze({
  DONE: 'done',
  CURRENT: 'current',
  PENDING: 'pending',
})

// Verification tokens are single-use; React StrictMode re-runs effects in
// development, so concurrent calls for the same token share one request.
const pendingVerifications = new Map()

function verifyOnce(token) {
  if (!pendingVerifications.has(token)) {
    const request = verifyEmailApi({ token }).finally(() => {
      pendingVerifications.delete(token)
    })
    pendingVerifications.set(token, request)
  }

  return pendingVerifications.get(token)
}

function toVerificationState(error) {
  if (error.status === 400 && error.details?.field === 'token') {
    return VERIFICATION_STATE.INVALID_TOKEN
  }

  if (error.status === 409 && error.details?.field === 'email') {
    return VERIFICATION_STATE.ALREADY_VERIFIED
  }

  return VERIFICATION_STATE.FAILED
}

function getSteps(state) {
  const verified =
    state === VERIFICATION_STATE.VERIFIED || state === VERIFICATION_STATE.ALREADY_VERIFIED

  return [
    { icon: UserRoundPlus, label: '1. Đăng ký tài khoản', status: STEP_STATE.DONE },
    {
      icon: MailCheck,
      label: '2. Xác thực email',
      status: verified ? STEP_STATE.DONE : STEP_STATE.CURRENT,
    },
    {
      icon: LogIn,
      label: '3. Đăng nhập',
      status: verified ? STEP_STATE.CURRENT : STEP_STATE.PENDING,
    },
  ]
}

const STEP_STATUS_COPY = Object.freeze({
  [STEP_STATE.DONE]: 'Hoàn tất',
  [STEP_STATE.CURRENT]: 'Bước kế tiếp',
  [STEP_STATE.PENDING]: 'Chờ thực hiện',
})

function VerificationSteps({ state }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {getSteps(state).map((step) => {
        const Icon = step.icon

        return (
          <li
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg px-3 py-3 text-center',
              step.status === STEP_STATE.CURRENT ? 'bg-primary/10' : 'bg-secondary/60',
            )}
            key={step.label}
          >
            <Icon
              aria-hidden="true"
              className={cn(
                'size-4',
                step.status === STEP_STATE.PENDING ? 'text-muted-foreground' : 'text-primary',
              )}
            />
            <span
              className={cn(
                'text-xs font-semibold',
                step.status === STEP_STATE.PENDING && 'text-muted-foreground',
              )}
            >
              {step.label}
            </span>
            <span
              className={cn(
                'text-xs',
                step.status === STEP_STATE.PENDING ? 'text-muted-foreground' : 'text-primary',
              )}
            >
              {STEP_STATUS_COPY[step.status]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function ResultHeader({ icon: Icon, tone, title, description, spinning = false }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span
        className={cn(
          'flex size-20 items-center justify-center rounded-full ring-8',
          tone,
        )}
      >
        <Icon aria-hidden="true" className={cn('size-9', spinning && 'animate-spin')} />
      </span>
      <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <p className="max-w-md text-pretty text-sm text-muted-foreground sm:text-base">
        {description}
      </p>
    </div>
  )
}

function LoginNotice({ children }) {
  return (
    <div className="flex gap-3 rounded-xl bg-secondary/60 p-4 text-sm">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
      <p className="text-muted-foreground">{children}</p>
    </div>
  )
}

function LoginButton({ email }) {
  return (
    <Button asChild className="h-11 w-full">
      <Link replace state={email ? { registeredEmail: email } : null} to="/login">
        Đăng nhập và tiếp tục
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </Button>
  )
}

function EmailVerificationResult({ token }) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ attempt: -1, state: null, email: null })
  const state =
    !token
      ? VERIFICATION_STATE.INVALID_TOKEN
      : result.attempt === attempt
        ? result.state
        : VERIFICATION_STATE.VERIFYING

  useEffect(() => {
    if (!token) {
      return
    }

    let active = true

    verifyOnce(token).then(
      (response) => {
        if (active) {
          setResult({ attempt, state: VERIFICATION_STATE.VERIFIED, email: response.user?.email })
        }
      },
      (error) => {
        if (active) {
          setResult({ attempt, state: toVerificationState(error), email: null })
        }
      },
    )

    return () => {
      active = false
    }
  }, [attempt, token])

  return (
    <div aria-live="polite" className="flex flex-col gap-6">
      {state === VERIFICATION_STATE.VERIFYING && (
        <ResultHeader
          description="Vui lòng chờ trong giây lát, JOBHUB đang kiểm tra liên kết xác thực của bạn."
          icon={LoaderCircle}
          spinning
          title="Đang xác thực email…"
          tone="bg-primary/10 text-primary ring-primary/5"
        />
      )}

      {state === VERIFICATION_STATE.VERIFIED && (
        <>
          <ResultHeader
            description="Email của bạn đã được xác thực. Hãy đăng nhập để tiếp tục sử dụng JOBHUB."
            icon={CircleCheck}
            title="Xác thực email thành công"
            tone="bg-primary text-primary-foreground ring-primary/15"
          />
          <LoginNotice>
            Đăng nhập bằng{' '}
            {result.email ? (
              <span className="font-semibold text-foreground">{result.email}</span>
            ) : (
              'email'
            )}{' '}
            và mật khẩu bạn đã dùng khi đăng ký.
          </LoginNotice>
          <VerificationSteps state={state} />
          <LoginButton email={result.email} />
        </>
      )}

      {state === VERIFICATION_STATE.ALREADY_VERIFIED && (
        <>
          <ResultHeader
            description="Email của tài khoản này đã được xác thực trước đó. Bạn có thể đăng nhập ngay."
            icon={CircleCheck}
            title="Email đã được xác thực"
            tone="bg-primary/10 text-primary ring-primary/5"
          />
          <VerificationSteps state={state} />
          <LoginButton />
        </>
      )}

      {state === VERIFICATION_STATE.INVALID_TOKEN && (
        <>
          <ResultHeader
            description="Liên kết xác thực không hợp lệ, đã hết hạn hoặc đã được sử dụng. Liên kết xác thực chỉ dùng được một lần trong thời hạn hiệu lực."
            icon={CircleX}
            title="Liên kết không còn hiệu lực"
            tone="bg-destructive/10 text-destructive ring-destructive/5"
          />
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/login">Quay lại đăng nhập</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/register">Đăng ký tài khoản</Link>
            </Button>
          </div>
        </>
      )}

      {state === VERIFICATION_STATE.FAILED && (
        <>
          <ResultHeader
            description="Không thể xác thực email lúc này. Vui lòng kiểm tra kết nối và thử lại."
            icon={CircleX}
            title="Xác thực chưa hoàn tất"
            tone="bg-destructive/10 text-destructive ring-destructive/5"
          />
          <div className="flex justify-center">
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

export default EmailVerificationResult
