import { Building2, Clock, ShieldCheck } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import CompanyApprovalConfirmationResult from '@/features/authentication/components/CompanyApprovalConfirmationResult'

const activationFacts = [
  {
    icon: Clock,
    title: 'Liên kết có thời hạn',
    description: 'Nếu liên kết hết hạn, Company Manager có thể yêu cầu gửi lại email kích hoạt.',
  },
  {
    icon: ShieldCheck,
    title: 'Chỉ dùng một lần',
    description: 'Liên kết đã dùng để kích hoạt không thể dùng lại.',
  },
]

function ConfirmCompanyApprovalPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="grid overflow-hidden rounded-2xl border bg-card shadow-sm lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="flex flex-col gap-10 bg-hero p-8 text-hero-foreground sm:p-10">
          <div>
            <span className="flex w-fit items-center gap-2 rounded-full bg-hero-foreground/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              <Building2 aria-hidden="true" className="size-4" />
              Kích hoạt doanh nghiệp
            </span>
            <h2 className="mt-6 text-balance text-3xl font-bold tracking-tight">
              Sẵn sàng bắt đầu cùng JOBHUB
            </h2>
            <p className="mt-4 text-pretty text-hero-muted">
              Hồ sơ doanh nghiệp đã được Platform Admin phê duyệt. Bước xác nhận cuối cùng
              kích hoạt đồng thời tài khoản Company Manager và doanh nghiệp.
            </p>
          </div>

          <ul className="mt-auto space-y-3">
            {activationFacts.map((fact) => {
              const Icon = fact.icon

              return (
                <li
                  className="flex items-center gap-3 rounded-xl bg-hero-foreground/10 p-4"
                  key={fact.title}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-hero-foreground/10">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{fact.title}</span>
                    <span className="block text-xs text-hero-muted">{fact.description}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </aside>

        <div className="flex flex-col justify-center p-8 sm:p-10">
          <CompanyApprovalConfirmationResult key={token} token={token} />
        </div>
      </div>
    </section>
  )
}

export default ConfirmCompanyApprovalPage
