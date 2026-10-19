import { ArrowLeft, KeyRound, MailCheck, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import ForgotPasswordForm from '@/features/authentication/components/ForgotPasswordForm'

function ForgotPasswordPage() {
  const [requestedEmail, setRequestedEmail] = useState(null)

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="grid overflow-hidden rounded-2xl border bg-card shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="flex flex-col gap-6 bg-hero p-8 text-hero-foreground sm:p-10">
          <span className="flex w-fit items-center gap-2 rounded-full bg-hero-foreground/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Khôi phục tài khoản
          </span>
          <h2 className="text-balance text-3xl font-bold tracking-tight">
            Khôi phục quyền truy cập nhanh chóng và an toàn
          </h2>
          <p className="text-pretty text-hero-muted">
            Liên kết đặt lại mật khẩu có thời hạn và chỉ dùng được một lần. Một
            yêu cầu mới sẽ thay thế yêu cầu cũ chưa hoàn tất.
          </p>
        </aside>

        <div className="flex flex-col gap-6 p-8 sm:p-10">
          {requestedEmail ? (
            <div aria-live="polite" className="space-y-4">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MailCheck aria-hidden="true" className="size-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Kiểm tra email của bạn
              </h1>
              <p className="text-sm text-muted-foreground">
                Nếu{' '}
                <span className="font-semibold text-foreground">{requestedEmail}</span>{' '}
                thuộc một tài khoản có thể khôi phục, hướng dẫn đặt lại mật khẩu
                đã được gửi tới email này.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/login">Quay lại đăng nhập</Link>
                </Button>
                <Button onClick={() => setRequestedEmail(null)} type="button" variant="outline">
                  Gửi lại với email khác
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <KeyRound aria-hidden="true" className="size-6 text-primary" />
                <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                  Quên mật khẩu?
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Nhập email đã đăng ký và JOBHUB sẽ gửi hướng dẫn đặt lại mật khẩu.
                </p>
              </div>

              <ForgotPasswordForm onRequested={setRequestedEmail} />

              <Link
                className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                to="/login"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Quay lại đăng nhập
              </Link>
            </>
          )}

          <div className="flex gap-3 rounded-xl bg-secondary/60 p-4 text-sm">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">
                Bảo vệ quyền riêng tư người dùng
              </span>
              <br />
              JOBHUB không tiết lộ một email có thuộc tài khoản nào hay không.
              Kết quả hiển thị luôn giống nhau với mọi email hợp lệ.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ForgotPasswordPage
