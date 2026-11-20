import {
  Award,
  CalendarClock,
  ClipboardCheck,
  FileSearch,
  MessageSquare,
  Send,
  Undo2,
  XCircle,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { APPLICATION_STATUS } from '@/utils/constant'

import { APPLICATION_STATUS_LABEL } from '../utils'

const APPLICATION_STATUS_STYLE = Object.freeze({
  [APPLICATION_STATUS.APPLIED]: {
    icon: Send,
    badge: 'border-slate-300/80 bg-slate-100 text-slate-700',
    card: 'border-l-slate-400',
  },
  [APPLICATION_STATUS.SCREENING]: {
    icon: FileSearch,
    badge: 'border-sky-500/30 bg-sky-500/10 text-sky-700',
    card: 'border-l-sky-500',
  },
  [APPLICATION_STATUS.CONTACTED]: {
    icon: MessageSquare,
    badge: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700',
    card: 'border-l-indigo-500',
  },
  [APPLICATION_STATUS.INTERVIEW_SCHEDULED]: {
    icon: CalendarClock,
    badge: 'border-amber-500/35 bg-amber-500/15 text-amber-800',
    card: 'border-l-amber-500 bg-amber-500/[0.03]',
  },
  [APPLICATION_STATUS.INTERVIEW_COMPLETED]: {
    icon: ClipboardCheck,
    badge: 'border-violet-500/30 bg-violet-500/10 text-violet-700',
    card: 'border-l-violet-500',
  },
  [APPLICATION_STATUS.HIRED]: {
    icon: Award,
    badge: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-800',
    card: 'border-l-emerald-500 bg-emerald-500/[0.04]',
  },
  [APPLICATION_STATUS.REJECTED]: {
    icon: XCircle,
    badge: 'border-rose-500/30 bg-rose-500/10 text-rose-700',
    card: 'border-l-rose-400 opacity-85',
  },
  [APPLICATION_STATUS.WITHDRAWN]: {
    icon: Undo2,
    badge: 'border-border bg-muted text-muted-foreground',
    card: 'border-dashed border-l-slate-300 opacity-75',
  },
})

function ApplicationStatusBadge({ status, className }) {
  const style = APPLICATION_STATUS_STYLE[status]
  const Icon = style?.icon

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        style?.badge ?? 'border-border bg-secondary text-secondary-foreground',
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
      <span>{APPLICATION_STATUS_LABEL[status] ?? status}</span>
    </span>
  )
}

export { APPLICATION_STATUS_STYLE }
export default ApplicationStatusBadge
