import { UserRound } from 'lucide-react'

import { cn } from '@/lib/utils'

import { formatDateTime } from '../utils'

function MessageBubble({
  message,
  side,
  recruiterName,
  recruiterAvatarUrl = null,
  showSenderMeta = false,
  showAvatar = false,
  tightTop = false,
}) {
  const timeLabel = formatDateTime(message.createdAt)

  if (side === 'system') {
    return (
      <li className="flex justify-center px-3 py-1">
        <div className="max-w-[min(24rem,90%)] text-center">
          <p className="rounded-full bg-muted/80 px-2.5 py-1 text-[10px] leading-relaxed text-muted-foreground">
            {message.content}
          </p>
        </div>
      </li>
    )
  }

  const isOwn = side === 'own'

  return (
    <li
      className={cn(
        'flex gap-2 px-3 sm:px-4',
        isOwn ? 'justify-end' : 'justify-start',
        tightTop ? 'mt-0.5' : 'mt-2',
      )}
    >
      {!isOwn ? (
        showAvatar ? (
          recruiterAvatarUrl ? (
            <img
              alt=""
              className="mt-auto size-7 shrink-0 rounded-full object-cover"
              src={recruiterAvatarUrl}
            />
          ) : (
            <span className="mt-auto flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <UserRound aria-hidden="true" className="size-3" />
            </span>
          )
        ) : (
          <span aria-hidden="true" className="size-7 shrink-0" />
        )
      ) : null}

      <div className={cn('flex w-[min(100%,28rem)] max-w-[78%] flex-col', isOwn ? 'items-end' : 'items-start')}>
        {showSenderMeta ? (
          <span className="mb-0.5 px-1 text-[10px] font-medium text-muted-foreground">
            {recruiterName || 'Nhà tuyển dụng'}
          </span>
        ) : null}
        <div
          className={cn(
            'px-2.5 py-1.5 text-[13px] leading-5',
            isOwn
              ? 'rounded-2xl rounded-br-md bg-primary text-primary-foreground'
              : 'rounded-2xl rounded-bl-md border border-border/70 bg-card text-foreground shadow-sm',
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        {timeLabel ? (
          <span className="mt-0.5 px-1 text-[10px] text-muted-foreground">{timeLabel}</span>
        ) : null}
      </div>
    </li>
  )
}

export default MessageBubble
