import {
  ArrowLeft,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import CompanyLogo from '@/features/job-discovery/components/CompanyLogo'
import useDiscoveryCatalogs from '@/features/job-discovery/hooks/useDiscoveryCatalogs'
import {
  EMPLOYMENT_TYPE_LABEL,
  formatProvince,
  formatRelativeTime,
  formatSalary,
  formatWorkModes,
} from '@/features/job-discovery/utils'
import { cn } from '@/lib/utils'

import { JOB_STATUS_LABEL, formatDate } from '../utils'

function FactRow({ icon: Icon, label, value }) {
  if (!value) {
    return null
  }
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-card px-4 py-3.5 shadow-sm">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  )
}

function SavedJobDetailPanel({ entry, onBack = null, onUnsave }) {
  const { provinceNameByCode } = useDiscoveryCatalogs()
  const [busy, setBusy] = useState(false)

  if (!entry?.job) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-muted/20 p-6">
        <CenteredState
          description="Chọn một việc làm ở danh sách bên trái để xem chi tiết."
          icon={BriefcaseBusiness}
          title="Chọn việc đã lưu"
          tone="bg-secondary text-muted-foreground"
        />
      </div>
    )
  }

  const job = entry.job
  const company = job.company
  const statusLabel = JOB_STATUS_LABEL[job.status] ?? job.status
  const savedLabel = formatDate(entry.savedAt)
  const deadlineLabel = formatDate(job.applicationDeadline)
  const publishedAgo = formatRelativeTime(job.publishedAt)
  const salaryLabel = formatSalary(job.salary)
  const employmentLabel = EMPLOYMENT_TYPE_LABEL[job.employmentType] ?? job.employmentType
  const workModeLabel = formatWorkModes(job.workModes)
  const locationLabel = [
    job.location?.addressText,
    formatProvince(job.location, provinceNameByCode),
  ]
    .filter(Boolean)
    .join(', ')

  const handleUnsave = async () => {
    setBusy(true)
    try {
      await onUnsave(job.id)
    } catch (error) {
      toast.error(error.message || 'Không bỏ lưu được việc làm.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background">
      <header className="shrink-0 border-b bg-card px-3 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          {onBack ? (
            <Button
              aria-label="Quay lại danh sách"
              className="shrink-0 lg:hidden"
              onClick={onBack}
              size="icon"
              type="button"
              variant="ghost"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
            </Button>
          ) : null}

          <CompanyLogo className="size-11 shrink-0 rounded-full" company={company} />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="truncate text-base font-semibold tracking-tight">
                {company?.name ?? 'Công ty'}
              </h2>
              {statusLabel ? (
                <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  {statusLabel}
                </span>
              ) : null}
              {entry.hasApplication ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  <CheckCircle2 aria-hidden="true" className="size-3" />
                  Đã ứng tuyển
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{job.title}</p>
          </div>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 overflow-y-auto bg-[linear-gradient(180deg,color-mix(in_oklch,var(--muted)_35%,transparent),transparent_180px)]">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-4 px-4 py-5 sm:px-6">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Việc làm đã lưu
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-balance sm:text-2xl">
                {job.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {company?.name}
                {savedLabel ? ` · Lưu ngày ${savedLabel}` : null}
                {publishedAgo ? ` · Đăng ${publishedAgo}` : null}
              </p>

              <div
                className={cn(
                  'mt-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold',
                  'bg-success text-success-foreground',
                )}
              >
                <Banknote aria-hidden="true" className="size-4" />
                {salaryLabel}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FactRow icon={BriefcaseBusiness} label="Hình thức" value={employmentLabel} />
              <FactRow icon={Clock3} label="Làm việc" value={workModeLabel} />
              <FactRow icon={MapPin} label="Địa điểm" value={locationLabel} />
              <FactRow icon={CalendarDays} label="Hạn ứng tuyển" value={deadlineLabel} />
            </div>

            <div className="mt-auto rounded-2xl border border-dashed bg-card/70 px-4 py-5 text-center">
              <p className="text-sm font-medium">Xem JD đầy đủ trên trang việc làm</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Đọc mô tả chi tiết, yêu cầu và nộp hồ sơ trực tiếp từ trang việc làm.
              </p>
              <Button asChild className="mt-4">
                <Link to={`/jobs/${encodeURIComponent(job.id)}`}>
                  Mở trang việc làm
                  <ExternalLink aria-hidden="true" className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t bg-card px-3 py-3 sm:px-5">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 rounded-2xl border bg-background p-2 shadow-sm">
          <Button asChild className="min-w-0 flex-1 sm:flex-none">
            <Link to={`/jobs/${encodeURIComponent(job.id)}`}>
              Xem chi tiết JD
              <ExternalLink aria-hidden="true" className="size-4" />
            </Link>
          </Button>
          <Button
            className="min-w-0 flex-1 sm:flex-none"
            disabled={busy}
            onClick={handleUnsave}
            type="button"
            variant="outline"
          >
            {busy ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-4" />
            )}
            Bỏ lưu
          </Button>
        </div>
      </div>
    </section>
  )
}

export default SavedJobDetailPanel
