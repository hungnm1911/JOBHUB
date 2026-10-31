import { ArrowRight, BadgeCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import heroBackground from '@/assets/hero-background.jpg'
import { Button } from '@/components/ui/button'

import useDiscoveryJobs from '../hooks/useDiscoveryJobs'
import { formatProvince, formatSalary, formatWorkModes, getJobTags } from '../utils'

const HERO_JOB_COUNT = 2

const countFormatter = new Intl.NumberFormat('vi-VN')

function HeroJobPreview({ job, provinceNameByCode }) {
  const meta = [job.company.name, formatProvince(job.location, provinceNameByCode), formatWorkModes(job.workModes)]
    .filter(Boolean)
    .join(' • ')

  return (
    <li className="rounded-xl border border-hero-foreground/10 bg-hero-foreground/5 p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/30 text-sm font-semibold"
        >
          {job.company.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{job.title}</p>
          <p className="truncate text-xs text-hero-muted">{meta}</p>
        </div>
        <span className="shrink-0 rounded-md bg-success/15 px-2 py-1 text-xs font-semibold text-success">
          {formatSalary(job.salary)}
        </span>
      </div>
      {getJobTags(job, 2).length > 0 && (
        <ul aria-label="Danh mục" className="mt-3 flex flex-wrap gap-1.5">
          {getJobTags(job, 2).map((tag) => (
            <li className="rounded bg-hero-foreground/10 px-2 py-0.5 text-[11px] text-hero-muted" key={tag}>
              {tag}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function HomeHero({ fieldCount, provinceNameByCode }) {
  const { jobs, pagination, loading, error } = useDiscoveryJobs({ limit: HERO_JOB_COUNT })
  const totalJobs = loading || error ? null : pagination.total

  return (
    <section className="relative overflow-hidden bg-hero text-hero-foreground">
      <img
        alt=""
        className="absolute inset-0 size-full object-cover"
        decoding="async"
        fetchPriority="high"
        src={heroBackground}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-hero via-hero/85 to-hero/50"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--primary)_0%,transparent_55%)] opacity-40"
      />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-hero-foreground/10 px-3 py-1 text-xs font-medium">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            Nền tảng tuyển dụng JOBHUB
          </span>
          <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:leading-tight">
            Tìm công việc phù hợp với bạn trên JOBHUB
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-hero-muted">
            Khám phá những cơ hội nghề nghiệp phù hợp và kết nối với doanh nghiệp trên một nền
            tảng tuyển dụng tập trung.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button asChild size="lg" className="px-6">
              <Link to="/jobs">
                Tìm việc làm
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-hero-muted">
              {totalJobs != null && (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <BadgeCheck aria-hidden="true" className="size-4" />
                    {countFormatter.format(totalJobs)} vị trí đang tuyển
                  </span>
                  <span aria-hidden="true">•</span>
                </>
              )}
              <span>Cập nhật liên tục</span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-hero-foreground/10 bg-hero-foreground/5 p-5 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between">
            <span aria-hidden="true" className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-hero-foreground/30" />
              <span className="size-2.5 rounded-full bg-hero-foreground/30" />
              <span className="size-2.5 rounded-full bg-hero-foreground/30" />
            </span>
            <h2 className="text-xs font-medium text-hero-muted">Việc làm mới đăng</h2>
          </div>

          {loading && (
            <ul aria-busy="true" aria-label="Đang tải việc làm mới" className="mt-4 space-y-3">
              {Array.from({ length: HERO_JOB_COUNT }, (_, index) => (
                <li className="h-[88px] animate-pulse rounded-xl bg-hero-foreground/10" key={index} />
              ))}
            </ul>
          )}

          {!loading && !error && jobs.length > 0 && (
            <ul className="mt-4 space-y-3">
              {jobs.map((job) => (
                <HeroJobPreview job={job} key={job.id} provinceNameByCode={provinceNameByCode} />
              ))}
            </ul>
          )}

          {!loading && (error || jobs.length === 0) && (
            <p className="mt-4 rounded-xl bg-hero-foreground/5 p-6 text-center text-sm text-hero-muted">
              {error ? 'Chưa tải được việc làm mới.' : 'Chưa có việc làm nào đang tuyển.'}
            </p>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-hero-foreground/10 pt-4">
            <div className="flex flex-col rounded-xl bg-hero-foreground/5 p-4 text-center">
              <dt className="text-xs text-hero-muted">Việc làm đang tuyển</dt>
              <dd className="order-first text-xl font-bold">
                {totalJobs == null ? '—' : countFormatter.format(totalJobs)}
              </dd>
            </div>
            <div className="flex flex-col rounded-xl bg-hero-foreground/5 p-4 text-center">
              <dt className="text-xs text-hero-muted">Ngành nghề</dt>
              <dd className="order-first text-xl font-bold text-success">
                {fieldCount == null ? '—' : countFormatter.format(fieldCount)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}

export default HomeHero
