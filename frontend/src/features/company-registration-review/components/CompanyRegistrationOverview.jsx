import {
  ArrowRight,
  Ban,
  CircleCheck,
  CircleX,
  Clock,
  Hourglass,
  Inbox,
  LoaderCircle,
  Lock,
  RotateCw,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import CenteredState from '@/components/common/CenteredState'
import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import useCompanyRegistrations from '../hooks/useCompanyRegistrations'
import {
  REGISTRATION_STAGE,
  REGISTRATION_STAGE_META,
  REGISTRATION_STAGE_ORDER,
  countRegistrationsByStage,
  formatDateTime,
} from '../utils'

const PENDING_PREVIEW_LIMIT = 5
const DAY_MS = 24 * 60 * 60 * 1000

const STAGE_CARD = Object.freeze({
  [REGISTRATION_STAGE.PENDING]: {
    icon: Clock,
    tone: 'bg-warning/15 text-warning-foreground',
    hint: 'Cần Platform Admin ra quyết định',
  },
  [REGISTRATION_STAGE.AWAITING_CONFIRMATION]: {
    icon: Hourglass,
    tone: 'bg-primary/10 text-primary',
    hint: 'Đã phê duyệt, chờ mở link kích hoạt',
  },
  [REGISTRATION_STAGE.ACTIVE]: {
    icon: CircleCheck,
    tone: 'bg-primary text-primary-foreground',
    hint: 'Doanh nghiệp đang hoạt động',
  },
  [REGISTRATION_STAGE.REJECTED]: {
    icon: Ban,
    tone: 'bg-destructive/10 text-destructive',
    hint: 'Quyết định cuối cùng',
  },
  [REGISTRATION_STAGE.LOCKED]: {
    icon: Lock,
    tone: 'bg-destructive/10 text-destructive',
    hint: 'Không còn hoạt động',
  },
})

function formatWaitingTime(submittedAt, now) {
  const elapsed = now - new Date(submittedAt).getTime()

  if (!Number.isFinite(elapsed) || elapsed < 0) {
    return null
  }

  const days = Math.floor(elapsed / DAY_MS)
  if (days >= 1) {
    return `Chờ ${days} ngày`
  }

  const hours = Math.floor(elapsed / (60 * 60 * 1000))
  return hours >= 1 ? `Chờ ${hours} giờ` : 'Vừa gửi'
}

function CompanyRegistrationOverview({ listPath, detailPath, accountPanel }) {
  const { loading, items, error, loadedAt, reload } = useCompanyRegistrations()
  const countByStage = countRegistrationsByStage(items)
  const oldestPending = items
    .filter((item) => item.stage === REGISTRATION_STAGE.PENDING)
    .sort((left, right) => new Date(left.submittedAt) - new Date(right.submittedAt))
    .slice(0, PENDING_PREVIEW_LIMIT)

  return (
    <div className="space-y-6">
      <PageHeader
        actions={accountPanel}
        description="Theo dõi hồ sơ doanh nghiệp đã gửi xét duyệt trên JOBHUB."
        eyebrow="Quản trị nền tảng"
        title="Tổng quan"
      />

      {loading && (
        <CenteredState
          icon={LoaderCircle}
          spinning
          title="Đang tải số liệu…"
          tone="bg-primary/10 text-primary"
        />
      )}

      {!loading && error && (
        <CenteredState
          action={
            <Button onClick={reload} type="button">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          }
          description={error.message}
          icon={CircleX}
          title="Không thể tải số liệu"
          tone="bg-destructive/10 text-destructive"
        />
      )}

      {!loading && !error && (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {REGISTRATION_STAGE_ORDER.map((stage) => {
              const card = STAGE_CARD[stage]
              const Icon = card.icon

              return (
                <li key={stage}>
                  <Link
                    className="flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
                    to={listPath(stage)}
                  >
                    <span className={cn('flex size-10 items-center justify-center rounded-xl', card.tone)}>
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <span>
                      <span className="block text-3xl font-bold tracking-tight">{countByStage[stage]}</span>
                      <span className="mt-1 block text-sm font-semibold">
                        {REGISTRATION_STAGE_META[stage].label}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{card.hint}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>

          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
              <div>
                <h2 className="font-semibold">Hồ sơ chờ duyệt lâu nhất</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {countByStage[REGISTRATION_STAGE.PENDING]} hồ sơ đang chờ quyết định của bạn.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={reload} size="sm" type="button" variant="outline">
                  <RotateCw aria-hidden="true" className="size-4" />
                  Tải lại
                </Button>
                <Button asChild size="sm">
                  <Link to={listPath(REGISTRATION_STAGE.PENDING)}>
                    Xem tất cả
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {oldestPending.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-10 text-center text-sm text-muted-foreground">
                <Inbox aria-hidden="true" className="size-8" />
                Không có hồ sơ nào đang chờ duyệt.
              </div>
            ) : (
              <ul className="divide-y">
                {oldestPending.map((item) => (
                  <li key={item.id}>
                    <Link
                      className="grid items-center gap-3 p-4 transition-colors hover:bg-secondary/60 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_auto_auto] sm:gap-4 sm:px-5"
                      to={detailPath(item.id)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{item.companyName}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          MSDN: {item.businessRegistrationNumber}
                        </span>
                      </span>
                      <span className="min-w-0 truncate text-sm text-muted-foreground">
                        {item.manager?.email}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Gửi lúc {formatDateTime(item.submittedAt) ?? '—'}
                      </span>
                      <span className="w-fit rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning-foreground sm:justify-self-end">
                        {formatWaitingTime(item.submittedAt, loadedAt) ?? 'Chờ duyệt'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default CompanyRegistrationOverview
