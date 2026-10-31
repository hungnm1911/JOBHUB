import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  FileText,
  MessageSquareText,
  Search,
  Sparkles,
  UserRoundSearch,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

const candidateBenefits = [
  {
    icon: Search,
    title: 'Khám phá cơ hội phù hợp',
    description:
      'Tiếp cận các cơ hội nghề nghiệp và tập trung vào những vị trí phù hợp với định hướng của bạn.',
  },
  {
    icon: FileText,
    title: 'Hồ sơ nghề nghiệp rõ ràng',
    description:
      'Xây dựng thông tin nghề nghiệp tập trung để sẵn sàng kết nối với nhà tuyển dụng.',
  },
  {
    icon: MessageSquareText,
    title: 'Kết nối trong một hành trình',
    description:
      'Theo dõi các bước tuyển dụng và giữ trao đổi với doanh nghiệp trong cùng một nền tảng.',
  },
]

const recruiterBenefits = [
  {
    icon: BriefcaseBusiness,
    title: 'Tổ chức nhu cầu tuyển dụng',
    description:
      'Quản lý công việc tuyển dụng theo một quy trình thống nhất thay vì phân tán qua nhiều công cụ.',
  },
  {
    icon: UsersRound,
    title: 'Phối hợp cùng đội ngũ',
    description:
      'Giúp đội ngũ tuyển dụng cùng theo dõi ứng viên, trách nhiệm và tiến độ xử lý.',
  },
  {
    icon: CalendarCheck2,
    title: 'Liền mạch đến phỏng vấn',
    description:
      'Giữ các hoạt động trao đổi và phỏng vấn gần với ngữ cảnh của từng ứng viên.',
  },
]

const journeySteps = [
  {
    number: '01',
    title: 'Tạo tài khoản',
    description: 'Chọn vai trò ứng viên hoặc doanh nghiệp để bắt đầu đúng hành trình.',
  },
  {
    number: '02',
    title: 'Hoàn thiện thông tin',
    description: 'Chuẩn bị hồ sơ nghề nghiệp hoặc thông tin doanh nghiệp cần thiết.',
  },
  {
    number: '03',
    title: 'Bắt đầu kết nối',
    description: 'Tiếp cận cơ hội và xây dựng các kết nối tuyển dụng có giá trị.',
  },
]

function HomePage() {
  return (
    <div className="w-full overflow-hidden">
      <section className="relative bg-hero text-hero-foreground">
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-28 size-96 rounded-full border border-hero-foreground/10"
        />
        <div
          aria-hidden="true"
          className="absolute -right-6 top-16 size-64 rounded-full border border-hero-foreground/10"
        />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-hero-foreground/15 bg-hero-foreground/10 px-3 py-1.5 text-sm font-medium text-hero-muted">
              <Sparkles aria-hidden="true" className="size-4" />
              Nền tảng tuyển dụng dành cho bạn
            </span>

            <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-6xl sm:leading-[1.08]">
              Kết nối đúng cơ hội.
              <span className="block text-primary-foreground/80">Tuyển đúng người.</span>
            </h1>

            <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-hero-muted">
              JOBHUB kết nối ứng viên và doanh nghiệp trong một hành trình tuyển
              dụng rõ ràng, tập trung và thuận tiện hơn.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-primary-foreground text-hero hover:bg-primary-foreground/90">
                <Link to="/register/candidate">
                  Tìm cơ hội phù hợp
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-hero-foreground/20 bg-transparent text-hero-foreground shadow-none hover:bg-hero-foreground/10 hover:text-hero-foreground"
              >
                <Link to="/register/company">Dành cho doanh nghiệp</Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-hero-muted">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 aria-hidden="true" className="size-4 text-primary-foreground" />
                Một tài khoản, một hành trình
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 aria-hidden="true" className="size-4 text-primary-foreground" />
                Dành cho ứng viên và doanh nghiệp
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:mr-0">
            <div className="rounded-3xl border border-hero-foreground/15 bg-hero-foreground/10 p-4 shadow-2xl shadow-black/10 backdrop-blur-sm sm:p-5">
              <div className="rounded-2xl bg-card p-5 text-card-foreground shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      Hành trình nghề nghiệp
                    </p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight">
                      Cơ hội bắt đầu từ một kết nối phù hợp
                    </h2>
                  </div>
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <UserRoundSearch aria-hidden="true" className="size-5" />
                  </span>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-4 rounded-xl border bg-background p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Search aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">Khám phá cơ hội</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Bắt đầu từ mục tiêu nghề nghiệp của bạn
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 rounded-xl border bg-background p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">Kết nối doanh nghiệp</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Hiểu rõ hơn nơi bạn muốn đồng hành
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 rounded-xl border bg-background p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <CalendarCheck2 aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">Tiến tới phỏng vấn</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Theo dõi hành trình trong cùng một không gian
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-xl bg-primary/5 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Sẵn sàng bắt đầu?</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Tạo tài khoản để mở hành trình của bạn.
                      </p>
                    </div>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border bg-card p-4 text-card-foreground shadow-lg sm:block">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UsersRound aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Ứng viên & doanh nghiệp</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Cùng một hệ sinh thái</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Một nền tảng, hai hành trình
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Tập trung vào điều quan trọng nhất trong tuyển dụng
          </h2>
          <p className="mt-4 text-pretty leading-7 text-muted-foreground">
            Ứng viên tìm thấy cơ hội phù hợp hơn. Doanh nghiệp tổ chức quá trình
            tuyển dụng rõ ràng hơn. JOBHUB tạo điểm kết nối giữa hai phía.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {candidateBenefits.map(({ icon: Icon, title, description }) => (
            <article className="rounded-2xl border bg-card p-6 shadow-sm" key={title}>
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y bg-card">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:py-20">
          <div>
            <span className="flex size-12 items-center justify-center rounded-xl bg-hero text-hero-foreground">
              <Building2 aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Dành cho doanh nghiệp
            </p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Xây dựng quy trình tuyển dụng có tổ chức
            </h2>
            <p className="mt-4 max-w-lg text-pretty leading-7 text-muted-foreground">
              Đưa nhu cầu tuyển dụng, đội ngũ và hành trình ứng viên về một nơi
              để việc phối hợp trở nên rõ ràng hơn.
            </p>
            <Button asChild className="mt-7" size="lg">
              <Link to="/register/company">
                Bắt đầu với doanh nghiệp
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {recruiterBenefits.map(({ icon: Icon, title, description }) => (
              <article
                className="flex flex-col gap-4 rounded-2xl border bg-background p-5 sm:p-6 lg:flex-row lg:items-start"
                key={title}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Bắt đầu đơn giản
            </p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Ba bước để bắt đầu hành trình cùng JOBHUB
            </h2>
          </div>
          <p className="max-w-2xl text-pretty leading-7 text-muted-foreground lg:justify-self-end">
            Chọn đúng vai trò ngay từ đầu, hoàn thiện thông tin cần thiết và bắt
            đầu kết nối trong một trải nghiệm nhất quán.
          </p>
        </div>

        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {journeySteps.map((step) => (
            <li className="relative rounded-2xl border bg-card p-6 shadow-sm" key={step.number}>
              <span className="text-sm font-bold tracking-[0.14em] text-primary">{step.number}</span>
              <h3 className="mt-8 text-lg font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="px-6 pb-16 lg:pb-20">
        <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-3xl bg-hero px-6 py-10 text-hero-foreground sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:px-12 lg:py-12">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-hero-muted">
              Sẵn sàng cho bước tiếp theo?
            </p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Bắt đầu xây dựng kết nối nghề nghiệp của bạn hôm nay.
            </h2>
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:shrink-0">
            <Button asChild size="lg" className="bg-primary-foreground text-hero hover:bg-primary-foreground/90">
              <Link to="/register">
                Tạo tài khoản
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-hero-foreground/20 bg-transparent text-hero-foreground shadow-none hover:bg-hero-foreground/10 hover:text-hero-foreground"
            >
              <Link to="/login">Đăng nhập</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default HomePage
