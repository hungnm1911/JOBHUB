import { BriefcaseBusiness, CheckCircle2, ClipboardList, MessagesSquare } from 'lucide-react'

import { cn } from '@/lib/utils'

const STAT_TONES = Object.freeze({
  total: {
    iconWrap: 'bg-primary/10 text-primary',
    activeRing: 'border-primary/40 ring-2 ring-primary/20 bg-primary/[0.03]',
  },
  reviewing: {
    iconWrap: 'bg-indigo-500/15 text-indigo-700',
    activeRing: 'border-indigo-500/40 ring-2 ring-indigo-500/20 bg-indigo-500/[0.03]',
  },
  interviewing: {
    iconWrap: 'bg-amber-500/15 text-amber-700',
    activeRing: 'border-amber-500/40 ring-2 ring-amber-500/20 bg-amber-500/[0.04]',
  },
  hired: {
    iconWrap: 'bg-emerald-500/15 text-emerald-700',
    activeRing: 'border-emerald-500/40 ring-2 ring-emerald-500/20 bg-emerald-500/[0.04]',
  },
})

function StatCard({ icon: Icon, label, value, toneKey, active = false, onClick }) {
  const tone = STAT_TONES[toneKey] ?? STAT_TONES.total

  return (
    <button
      aria-pressed={active}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3.5 text-left transition-all',
        'hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        active && tone.activeRing,
      )}
      onClick={onClick}
      type="button"
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      </div>
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          tone.iconWrap,
        )}
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>
    </button>
  )
}

function ApplicationListStats({ stats, activeQuickFilter = 'all', onQuickFilter }) {
  if (!stats) {
    return null
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        active={activeQuickFilter === 'all'}
        icon={BriefcaseBusiness}
        label="Tổng đơn đã gửi"
        onClick={() => onQuickFilter?.('all')}
        toneKey="total"
        value={stats.total}
      />
      <StatCard
        active={activeQuickFilter === 'reviewing'}
        icon={ClipboardList}
        label="Đang xét duyệt & Liên hệ"
        onClick={() => onQuickFilter?.('reviewing')}
        toneKey="reviewing"
        value={stats.reviewing}
      />
      <StatCard
        active={activeQuickFilter === 'interviewing'}
        icon={MessagesSquare}
        label="Phỏng vấn"
        onClick={() => onQuickFilter?.('interviewing')}
        toneKey="interviewing"
        value={stats.interviewing}
      />
      <StatCard
        active={activeQuickFilter === 'hired'}
        icon={CheckCircle2}
        label="Được nhận"
        onClick={() => onQuickFilter?.('hired')}
        toneKey="hired"
        value={stats.hired}
      />
    </section>
  )
}

export default ApplicationListStats
