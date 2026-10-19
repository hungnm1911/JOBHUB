import { ArrowLeft, CircleX, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import ResetPasswordForm from '@/features/authentication/components/ResetPasswordForm'
import { FLASH_MESSAGE_TYPE } from '@/utils/constant'

const RESET_STATE = Object.freeze({
  FORM: 'form',
  INVALID_TOKEN: 'invalidToken',
})

function ResetPasswordResult({ icon: Icon, tone, title, description, action }) {
  return (
    <div aria-live="polite" className="space-y-4">
      <span className={`flex size-11 items-center justify-center rounded-full ${tone}`}>
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  )
}

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [resetState, setResetState] = useState(
    token ? RESET_STATE.FORM : RESET_STATE.INVALID_TOKEN,
  )

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="grid overflow-hidden rounded-2xl border bg-card shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="flex flex-col gap-6 bg-hero p-8 text-hero-foreground sm:p-10">
          <span className="flex w-fit items-center gap-2 rounded-full bg-hero-foreground/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Thiết lập mật khẩu mới
          </span>
          <h2 className="text-balance text-3xl font-bold tracking-tight">
            Khởi tạo mật khẩu an toàn
          </h2>
          <p className="text-pretty text-hero-muted">
            Sau khi đặt lại mật khẩu, mọi phiên đăng nhập hiện có của tài khoản
            sẽ bị thu hồi và bạn cần đăng nhập lại bằng mật khẩu mới.
          </p>
        </aside>

        <div className="flex flex-col gap-6 p-8 sm:p-10">
          {resetState === RESET_STATE.FORM && (
            <>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Đặt lại mật khẩu
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tạo mật khẩu mới cho tài khoản JOBHUB của bạn.
                </p>
              </div>

              <ResetPasswordForm
                onInvalidToken={() => setResetState(RESET_STATE.INVALID_TOKEN)}
                onReset={() =>
                  navigate('/login', {
                    replace: true,
                    state: {
                      flash: {
                        type: FLASH_MESSAGE_TYPE.SUCCESS,
                        title: 'Đặt lại mật khẩu thành công',
                        message:
                          'Mật khẩu mới đã có hiệu lực. Các phiên đăng nhập trước đó không còn giá trị, vui lòng đăng nhập lại.',
                      },
                    },
                  })
                }
                token={token}
              />

              <Link
                className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                to="/login"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Quay lại đăng nhập
              </Link>
            </>
          )}

          {resetState === RESET_STATE.INVALID_TOKEN && (
            <ResetPasswordResult
              action={
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link replace to="/forgot-password">
                      Gửi yêu cầu mới
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/login">Quay lại đăng nhập</Link>
                  </Button>
                </div>
              }
              description="Liên kết đặt lại mật khẩu không hợp lệ, đã hết hạn hoặc đã được sử dụng. Vui lòng gửi yêu cầu đặt lại mật khẩu mới."
              icon={CircleX}
              title="Liên kết không còn hiệu lực"
              tone="bg-destructive/10 text-destructive"
            />
          )}
        </div>
      </div>
    </section>
  )
}

export default ResetPasswordPage
