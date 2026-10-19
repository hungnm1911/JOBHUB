import { ChevronRight, CircleX, Inbox, LoaderCircle, RotateCw, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import CenteredState from '@/components/common/CenteredState'
import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

import useCompanyRegistrations from '../hooks/useCompanyRegistrations'
import {
  REGISTRATION_STAGE_META,
  REGISTRATION_STAGE_ORDER,
  countRegistrationsByStage,
  formatDateTime,
} from '../utils'
import RegistrationStageBadge from './RegistrationStageBadge'

const ALL_STAGES = 'all'

function matchesQuery(item, query) {
  if (!query) {
    return true
  }

  return [item.companyName, item.businessRegistrationNumber, item.manager?.fullName, item.manager?.email]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(query))
}

function CompanyRegistrationList({ stage, onStageChange, detailPath, accountPanel }) {
  const { loading, items, error, reload } = useCompanyRegistrations()
  const [query, setQuery] = useState('')
  const activeStage = stage ?? ALL_STAGES
  const normalizedQuery = query.trim().toLowerCase()
  const countByStage = { ...countRegistrationsByStage(items), [ALL_STAGES]: items.length }
  const visibleItems = items.filter(
    (item) =>
      (activeStage === ALL_STAGES || item.stage === activeStage) && matchesQuery(item, normalizedQuery),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        actions={accountPanel}
        description="Xem hồ sơ doanh nghiệp đã gửi và phê duyệt hoặc từ chối các hồ sơ đang chờ duyệt."
        eyebrow="Quản trị nền tảng"
        title="Xét duyệt doanh nghiệp"
      />

      {loading && (
        <CenteredState
          icon={LoaderCircle}
          spinning
          title="Đang tải danh sách hồ sơ…"
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
          title="Không thể tải danh sách hồ sơ"
          tone="bg-destructive/10 text-destructive"
        />
      )}

      {!loading && !error && (
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="space-y-4 border-b p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2" role="tablist">
                {[...REGISTRATION_STAGE_ORDER, ALL_STAGES].map((tabStage) => (
                  <button
                    aria-selected={activeStage === tabStage}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                      activeStage === tabStage
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'bg-card text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )}
                    key={tabStage}
                    onClick={() => onStageChange(tabStage === ALL_STAGES ? null : tabStage)}
                    role="tab"
                    type="button"
                  >
                    {tabStage === ALL_STAGES ? 'Tất cả' : REGISTRATION_STAGE_META[tabStage].label}
                    <span className="text-xs opacity-80">{countByStage[tabStage]}</span>
                  </button>
                ))}
              </div>
              <Button onClick={reload} size="sm" type="button" variant="outline">
                <RotateCw aria-hidden="true" className="size-4" />
                Tải lại
              </Button>
            </div>
            <div className="relative max-w-md">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Tìm hồ sơ"
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo tên, mã số doanh nghiệp, Company Manager…"
                type="search"
                value={query}
              />
            </div>
          </div>

          {visibleItems.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center text-sm text-muted-foreground">
              <Inbox aria-hidden="true" className="size-8" />
              Không có hồ sơ phù hợp.
            </div>
          ) : (
            <ul className="divide-y">
              {visibleItems.map((item) => (
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
                    <span className="min-w-0 text-sm">
                      <span className="block truncate">{item.manager?.fullName ?? '—'}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.manager?.email}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Gửi lúc {formatDateTime(item.submittedAt) ?? '—'}
                    </span>
                    <span className="flex items-center gap-2 justify-self-start sm:justify-self-end">
                      <RegistrationStageBadge stage={item.stage} />
                      <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

export default CompanyRegistrationList
