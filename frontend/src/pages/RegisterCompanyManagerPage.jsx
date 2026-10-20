import { ArrowLeft, ChevronRight, CircleCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import CompanyManagerRegistrationForm from '@/features/authentication/components/CompanyManagerRegistrationForm'

const companyOnboardingSteps = ['Đăng ký', 'Hoàn thiện hồ sơ', 'Gửi xét duyệt', 'Kích hoạt']

function RegisterCompanyManagerPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="grid overflow-hidden rounded-2xl border bg-card shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="flex flex-col gap-10 bg-hero p-8 text-hero-foreground sm:p-10">
          <div>
            <span className="flex w-fit items-center gap-2 rounded-full bg-hero-foreground/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              <CircleCheck aria-hidden="true" className="size-4" />
              Dành cho doanh nghiệp
            </span>
            <h2 className="mt-6 text-balance text-3xl font-bold tracking-tight">
              Xây dựng đội ngũ nhân sự xuất sắc
            </h2>
            <p className="mt-4 text-pretty text-hero-muted">
              Thiết lập hồ sơ doanh nghiệp, tạo tài khoản Recruiter và đăng tin
              tuyển dụng sau khi doanh nghiệp được xét duyệt và kích hoạt.
            </p>
          </div>

          <div className="mt-auto rounded-xl bg-hero-foreground/10 p-4">
            <p className="text-sm font-semibold">Quy trình onboarding doanh nghiệp</p>
            <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-hero-muted">
              {companyOnboardingSteps.map((step, index) => (
                <li className="inline-flex items-center gap-2" key={step}>
                  {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5" />}
                  <span className={index === 0 ? 'font-semibold text-hero-foreground' : undefined}>
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        <div className="flex flex-col gap-6 p-8 sm:p-10">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold text-primary">
                Bước 2/2 Dành cho nhà tuyển dụng
              </span>
              <Link
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                to="/register"
              >
                <ArrowLeft aria-hidden="true" className="size-3.5" />
                Chọn lại loại tài khoản
              </Link>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Tạo tài khoản Company Manager
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Đăng ký tài khoản quản lý để thiết lập hồ sơ doanh nghiệp trên JOBHUB.
            </p>
          </div>

          <CompanyManagerRegistrationForm />

          <p className="rounded-xl bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
            Đã có tài khoản?{' '}
            <Link className="font-semibold text-primary hover:underline" to="/login">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}

export default RegisterCompanyManagerPage
