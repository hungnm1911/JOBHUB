import { ArrowRight, Building2, CircleCheck, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import RecruiterActivationForm from '@/features/authentication/components/RecruiterActivationForm'
import { cn } from '@/lib/utils'

const ACTIVATION_STATE = Object.freeze({
  FORM: 'form',
  INVALID_TOKEN: 'invalidToken',
  ALREADY_ACTIVATED: 'alreadyActivated',
  ACTIVATED: 'activated',
})

const cardClass = 'w-full rounded-2xl border bg-card p-6 shadow-sm sm:p-8'

function StatusCard({ icon: Icon, tone, title, children, action }) {
  const headingRef = useRef(null)

  // Move focus to the outcome so keyboard and screen reader users land on it.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <section aria-live="polite" className={cn(cardClass, 'space-y-4')}>
      <div className="flex items-center gap-3">
        <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-full', tone)}>
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <h1 className="text-lg font-semibold outline-none" ref={headingRef} tabIndex={-1}>
          {title}
        </h1>
      </div>
      <p className="text-sm text-muted-foreground">{children}</p>
      {action}
    </section>
  )
}

function RecruiterActivationPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [state, setState] = useState(token ? ACTIVATION_STATE.FORM : ACTIVATION_STATE.INVALID_TOKEN)
  const [outcome, setOutcome] = useState({ email: null, signedIn: false })

  let content
  if (state === ACTIVATION_STATE.FORM) {
    content = (
      <section className={cn(cardClass, 'space-y-6')}>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
              <Building2 aria-hidden="true" className="size-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight">Kích hoạt tài khoản Nhà tuyển dụng</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Quản lý công ty đã mời bạn tham gia JOBHUB với vai trò{' '}
            <strong className="font-semibold text-foreground">Nhà tuyển dụng</strong>. Đặt mật khẩu để
            bắt đầu. Chỉ bạn biết mật khẩu này.
          </p>
        </div>

        <RecruiterActivationForm
          onActivated={(result) => {
            setOutcome(result)
            setState(ACTIVATION_STATE.ACTIVATED)
          }}
          onAlreadyActivated={() => setState(ACTIVATION_STATE.ALREADY_ACTIVATED)}
          onInvalidToken={() => setState(ACTIVATION_STATE.INVALID_TOKEN)}
          token={token}
        />
      </section>
    )
  } else if (state === ACTIVATION_STATE.INVALID_TOKEN) {
    content = (
      <StatusCard
        action={
          <Button asChild className="w-full" variant="outline">
            <Link to="/login">Quay lại đăng nhập</Link>
          </Button>
        }
        icon={TriangleAlert}
        title="Liên kết đã hết hạn"
        tone="bg-warning/15 text-warning-foreground"
      >
        Liên kết kích hoạt tài khoản này đã hết hạn hoặc không còn hợp lệ. Vui lòng liên hệ Quản lý
        công ty để được gửi lại email mời mới.
      </StatusCard>
    )
  } else if (state === ACTIVATION_STATE.ALREADY_ACTIVATED) {
    content = (
      <StatusCard
        action={
          <Button asChild className="w-full">
            <Link to="/login">Đăng nhập</Link>
          </Button>
        }
        icon={CircleCheck}
        title="Tài khoản đã được kích hoạt"
        tone="bg-success text-success-foreground"
      >
        Tài khoản này đã có mật khẩu. Hãy đăng nhập, hoặc dùng chức năng quên mật khẩu nếu bạn không
        nhớ.
      </StatusCard>
    )
  } else {
    content = (
      <StatusCard
        action={
          <Button asChild className="h-11 w-full">
            <Link replace to={outcome.signedIn ? '/recruiter/jobs' : '/login'}>
              {outcome.signedIn ? 'Đi tới trang làm việc' : 'Đi tới đăng nhập'}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        }
        icon={CircleCheck}
        title="Kích hoạt thành công"
        tone="bg-success text-success-foreground"
      >
        {outcome.signedIn
          ? `Tài khoản Nhà tuyển dụng ${outcome.email ?? ''} đã sẵn sàng và bạn đã được đăng nhập.`
          : 'Tài khoản Nhà tuyển dụng của bạn đã sẵn sàng. Hãy đăng nhập bằng email công việc và mật khẩu vừa tạo.'}
      </StatusCard>
    )
  }

  return (
    <div className="flex w-full flex-1 items-start justify-center bg-background px-4 py-10 sm:items-center sm:py-16">
      <div className="w-full max-w-md">{content}</div>
    </div>
  )
}

export default RecruiterActivationPage
