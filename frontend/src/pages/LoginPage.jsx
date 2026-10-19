import { Building2, ChevronRight, CircleCheck, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import LoginForm from '@/features/authentication/components/LoginForm'

const registrationLinks = [
  {
    to: '/register/candidate',
    icon: UserRound,
    title: 'Đăng ký ứng viên',
    description: 'Tìm kiếm cơ hội',
  },
  {
    to: '/register/company',
    icon: Building2,
    title: 'Đăng ký doanh nghiệp',
    description: 'Tuyển mộ nhân tài',
  },
]

function LoginPage() {
  const location = useLocation()
  const [registeredEmail] = useState(() => location.state?.registeredEmail ?? '')

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="grid overflow-hidden rounded-2xl border bg-card shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="flex flex-col gap-10 bg-hero p-8 text-hero-foreground sm:p-10">
          <div>
            <span className="flex w-fit items-center gap-2 rounded-full bg-hero-foreground/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              <CircleCheck aria-hidden="true" className="size-4" />
              Đăng nhập hệ thống
            </span>
            <h2 className="mt-6 text-balance text-3xl font-bold tracking-tight">
              Một tài khoản, kết nối toàn bộ hệ sinh thái JOBHUB
            </h2>
            <p className="mt-4 text-pretty text-hero-muted">
              Nền tảng tuyển dụng và phát triển sự nghiệp dành cho ứng viên và
              doanh nghiệp.
            </p>
          </div>
        </aside>

        <div className="flex flex-col gap-6 p-8 sm:p-10">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Chào mừng trở lại
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Đăng nhập để tiếp tục với JOBHUB.
            </p>
          </div>

          <LoginForm defaultEmail={registeredEmail} />

          <div className="rounded-xl bg-secondary/60 p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Chưa có tài khoản?</span>{' '}
              Chọn phân hệ khởi tạo:
            </p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {registrationLinks.map((link) => {
                const Icon = link.icon

                return (
                  <li key={link.to}>
                    <Link
                      className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      to={link.to}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon aria-hidden="true" className="size-4" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold">{link.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {link.description}
                        </span>
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

export default LoginPage
