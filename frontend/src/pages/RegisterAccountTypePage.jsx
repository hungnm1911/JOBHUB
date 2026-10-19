import {
  ArrowRight,
  Building2,
  ChevronRight,
  CircleCheck,
  Info,
  MailCheck,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const accountTypes = [
  {
    to: '/register/candidate',
    icon: UserRound,
    title: 'Ứng viên',
    description:
      'Tìm kiếm cơ hội việc làm, quản lý hồ sơ và CV, ứng tuyển vào các vị trí phù hợp.',
    note: 'Xác thực email trước khi đăng nhập',
    noteIcon: MailCheck,
    action: 'Đăng ký tài khoản ứng viên',
  },
  {
    to: '/register/company',
    icon: Building2,
    title: 'Doanh nghiệp',
    badge: 'Dành cho nhà tuyển dụng',
    description:
      'Tạo tài khoản Quản trị Doanh nghiệp (Company Manager) cùng hồ sơ doanh nghiệp, gửi xét duyệt, sau đó tạo tài khoản Recruiter và đăng tin tuyển dụng.',
    note: 'Hồ sơ doanh nghiệp được xét duyệt trước khi hoạt động',
    noteIcon: ShieldCheck,
    action: 'Đăng ký cho doanh nghiệp',
  },
]

const onboardingFlows = [
  {
    title: 'Ứng viên',
    steps: ['Đăng ký', 'Xác thực email', 'Đăng nhập'],
  },
  {
    title: 'Doanh nghiệp',
    steps: ['Đăng ký', 'Hoàn thiện hồ sơ', 'Gửi xét duyệt', 'Kích hoạt'],
  },
]

function RegisterAccountTypePage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="grid overflow-hidden rounded-2xl border bg-card shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="flex flex-col gap-10 bg-hero p-8 text-hero-foreground sm:p-10">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-hero-foreground/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              <CircleCheck aria-hidden="true" className="size-4" />
              Nền tảng tuyển dụng
            </span>
            <h2 className="mt-6 text-balance text-3xl font-bold tracking-tight">
              Kết nối nhân tài, bứt phá sự nghiệp cùng JOBHUB
            </h2>
            <p className="mt-4 text-pretty text-hero-muted">
              Hệ thống tìm kiếm việc làm và quản trị tuyển dụng dành cho ứng
              viên và doanh nghiệp.
            </p>
          </div>

          <ul className="mt-auto space-y-4">
            {onboardingFlows.map((flow) => (
              <li
                className="rounded-xl bg-hero-foreground/10 p-4"
                key={flow.title}
              >
                <p className="text-sm font-semibold">{flow.title}</p>
                <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-hero-muted">
                  {flow.steps.map((step, index) => (
                    <li className="inline-flex items-center gap-2" key={step}>
                      {index > 0 && (
                        <ChevronRight aria-hidden="true" className="size-3.5" />
                      )}
                      {step}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex flex-col gap-6 p-8 sm:p-10">
          <div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                Bước 1/2
              </span>
              Phân loại đối tượng sử dụng
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Bạn muốn sử dụng JOBHUB như thế nào?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Chọn loại tài khoản phù hợp để bắt đầu quy trình thiết lập tài
              khoản.
            </p>
          </div>

          <ul className="space-y-4">
            {accountTypes.map((accountType) => {
              const Icon = accountType.icon
              const NoteIcon = accountType.noteIcon

              return (
                <li key={accountType.to}>
                  <Link
                    className="group block rounded-xl border p-5 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    to={accountType.to}
                  >
                    <div className="flex gap-4">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon aria-hidden="true" className="size-5" />
                      </span>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">
                            {accountType.title}
                          </h3>
                          {accountType.badge && (
                            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              {accountType.badge}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {accountType.description}
                        </p>
                      </div>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <NoteIcon aria-hidden="true" className="size-4" />
                        {accountType.note}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-primary">
                        {accountType.action}
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="flex gap-3 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>
              <span className="font-semibold">
                Lưu ý cho chuyên viên tuyển dụng (Recruiter):
              </span>{' '}
              Tài khoản Recruiter do Company Manager của công ty bạn tạo và
              kích hoạt qua email. Bạn không cần đăng ký tài khoản tại màn
              hình này.
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            Đã có tài khoản?{' '}
            <Link
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              to="/login"
            >
              Đăng nhập ngay
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}

export default RegisterAccountTypePage
