import { Lock, UserRound } from 'lucide-react'

import CompanyLogo from '@/features/job-discovery/components/CompanyLogo'
import { cn } from '@/lib/utils'

import {
  APPLICATION_STATUS_LABEL,
  CONVERSATION_MODE,
  formatConversationListTime,
} from '../utils'

function ConversationListItem({ thread, selected, onSelect }) {
  const application = thread.application
  const recruiter = application?.assignedRecruiter
  const company = application?.company
  const jobTitle = application?.job?.title
  const title = recruiter?.fullName || company?.name || 'Nhà tuyển dụng'
  const subtitle = [company?.name && recruiter?.fullName ? company.name : null, jobTitle]
    .filter(Boolean)
    .join(' · ')
  const preview =
    thread.lastMessage?.content?.trim() ||
    (thread.missing
      ? 'Hội thoại chưa được mở'
      : thread.loadError
        ? 'Không tải được hội thoại'
        : 'Chưa có tin nhắn')
  const timeLabel = formatConversationListTime(thread.lastActivityAt)
  const locked = thread.missing || (thread.hasConversation && !thread.canSend)
  const statusLabel = APPLICATION_STATUS_LABEL[application?.status] ?? application?.status

  return (
    <button
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
        selected
          ? 'bg-primary/8 ring-1 ring-primary/25'
          : 'hover:bg-secondary/70',
      )}
      onClick={() => onSelect(thread.applicationId)}
      type="button"
    >
      {recruiter?.avatarUrl ? (
        <img
          alt=""
          className="size-9 shrink-0 rounded-full object-cover"
          src={recruiter.avatarUrl}
        />
      ) : company ? (
        <CompanyLogo className="size-9 shrink-0 rounded-full" company={company} />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <UserRound aria-hidden="true" className="size-3.5" />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-foreground">{title}</span>
          <span className="shrink-0 pt-0.5 text-[10px] text-muted-foreground">{timeLabel}</span>
        </span>

        {subtitle ? (
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{subtitle}</span>
        ) : null}

        <span className="mt-1 flex items-center gap-1.5">
          {locked ? (
            <Lock aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
          ) : null}
          <span
            className={cn(
              'truncate text-xs',
              selected ? 'text-foreground/80' : 'text-muted-foreground',
            )}
          >
            {preview}
          </span>
        </span>

        {statusLabel && application?.status !== undefined ? (
          <span className="mt-1 inline-flex rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
            {statusLabel}
            {thread.mode === CONVERSATION_MODE.ACTIVE ? null : locked ? ' · Tạm khóa' : null}
          </span>
        ) : null}
      </span>
    </button>
  )
}

export default ConversationListItem
