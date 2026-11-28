import { LoaderCircle, MessageSquare, Send, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  getOwnApplicationConversationApi,
  sendOwnApplicationConversationMessageApi,
} from '@/apis/application.api'
import { Button } from '@/components/ui/button'
import useUnsavedChangesPrompt from '@/components/common/UnsavedChangesProvider/hooks/useUnsavedChangesPrompt'
import { cn } from '@/lib/utils'

import { formatDateTime } from '../utils'

function isConversationMissingError(error) {
  return (
    error?.status === 404 &&
    typeof error?.message === 'string' &&
    /conversation not found/i.test(error.message)
  )
}

function resolveMessageSide(message, currentUserId) {
  if (message.type === 'SYSTEM') {
    return 'system'
  }
  if (message.senderUserId && currentUserId && message.senderUserId === currentUserId) {
    return 'own'
  }
  return 'other'
}

function ChatBubble({ message, currentUserId }) {
  const side = resolveMessageSide(message, currentUserId)
  const timeLabel = formatDateTime(message.createdAt)

  if (side === 'system') {
    return (
      <li className="flex justify-center px-2 py-1">
        <div className="max-w-[85%] text-center">
          <p className="rounded-full bg-muted px-3 py-1 text-[11px] leading-relaxed text-muted-foreground">
            {message.content}
          </p>
          {timeLabel ? (
            <p className="mt-1 text-[10px] text-muted-foreground/80">{timeLabel}</p>
          ) : null}
        </div>
      </li>
    )
  }

  const isOwn = side === 'own'

  return (
    <li className={cn('flex gap-2 px-1', isOwn ? 'justify-end' : 'justify-start')}>
      {!isOwn ? (
        <span
          aria-hidden="true"
          className="mt-auto flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
        >
          <UserRound className="size-3.5" />
        </span>
      ) : null}

      <div className={cn('flex max-w-[78%] flex-col', isOwn ? 'items-end' : 'items-start')}>
        {!isOwn ? (
          <span className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">
            Nhà tuyển dụng
          </span>
        ) : null}
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm',
            isOwn
              ? 'rounded-br-md bg-primary text-primary-foreground'
              : 'rounded-bl-md bg-secondary text-secondary-foreground',
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        {timeLabel ? (
          <span className="mt-1 px-1 text-[10px] text-muted-foreground">{timeLabel}</span>
        ) : null}
      </div>
    </li>
  )
}

function ApplicationConversationPanel({ applicationId, open, onClose, currentUserId = null }) {
  const [loadedKey, setLoadedKey] = useState(null)
  const [error, setError] = useState(null)
  const [missing, setMissing] = useState(false)
  const [messages, setMessages] = useState([])
  const [authority, setAuthority] = useState(null)
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const { confirmDiscard } = useUnsavedChangesPrompt(open && Boolean(content.trim()))
  const handleClose = () => confirmDiscard(() => {
    setContent('')
    setLoadedKey(null)
    onClose()
  })
  const [reloadKey, setReloadKey] = useState(0)
  const listRef = useRef(null)
  const requestKey = `${applicationId}:${open}:${reloadKey}`
  const loading = open && loadedKey !== requestKey

  useEffect(() => {
    if (!open) {
      return undefined
    }

    let active = true

    getOwnApplicationConversationApi(applicationId).then(
      (response) => {
        if (!active) {
          return
        }
        setError(null)
        setMessages(response.messages ?? [])
        setAuthority(response.authority ?? null)
        setMissing(false)
        setLoadedKey(requestKey)
      },
      (loadError) => {
        if (!active) {
          return
        }
        setLoadedKey(requestKey)
        if (isConversationMissingError(loadError)) {
          setMissing(true)
          setMessages([])
          setAuthority(null)
          setError(null)
          return
        }
        setError(loadError)
      },
    )

    return () => {
      active = false
    }
  }, [applicationId, open, requestKey])

  useEffect(() => {
    if (!listRef.current) {
      return
    }
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, loading, open])

  if (!open) {
    return null
  }

  const handleSend = async (event) => {
    event.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) {
      return
    }

    setBusy(true)
    try {
      const response = await sendOwnApplicationConversationMessageApi(applicationId, trimmed)
      setContent('')
      if (response.message) {
        setMessages((current) => [...current, response.message])
      } else {
        setReloadKey((current) => current + 1)
      }
    } catch (sendError) {
      toast.error(sendError.message || 'Không gửi được tin nhắn.')
    } finally {
      setBusy(false)
    }
  }

  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (!busy && content.trim()) {
        event.currentTarget.form?.requestSubmit()
      }
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-labelledby="conversation-heading">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquare aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold" id="conversation-heading">
              Trao đổi với nhà tuyển dụng
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Hội thoại gắn với đơn ứng tuyển này.
            </p>
          </div>
        </div>
        <Button onClick={handleClose} size="sm" type="button" variant="ghost">
          Thu gọn
        </Button>
      </div>

      <div className="flex flex-col">
        <div
          className="max-h-[22rem] min-h-[14rem] overflow-y-auto bg-muted/40 px-3 py-4 sm:px-4"
          ref={listRef}
        >
          {loading ? (
            <div className="flex h-full min-h-[12rem] items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              Đang tải hội thoại…
            </div>
          ) : null}

          {!loading && error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error.message || 'Không tải được hội thoại.'}
              <Button
                className="ml-2"
                onClick={() => setReloadKey((current) => current + 1)}
                size="sm"
                type="button"
                variant="outline"
              >
                Thử lại
              </Button>
            </div>
          ) : null}

          {!loading && !error && missing ? (
            <p className="mx-auto max-w-sm rounded-full bg-muted px-4 py-2 text-center text-xs text-muted-foreground">
              Hội thoại chưa được mở. Hệ thống tạo hội thoại khi nhà tuyển dụng nhận phụ trách đơn.
            </p>
          ) : null}

          {!loading && !error && !missing && messages.length === 0 ? (
            <p className="mx-auto max-w-sm rounded-full bg-muted px-4 py-2 text-center text-xs text-muted-foreground">
              Chưa có tin nhắn nào. Hãy gửi lời chào để bắt đầu.
            </p>
          ) : null}

          {!loading && !error && !missing && messages.length > 0 ? (
            <ul className="space-y-2.5">
              {messages.map((message) => (
                <ChatBubble
                  currentUserId={currentUserId}
                  key={message.id}
                  message={message}
                />
              ))}
            </ul>
          ) : null}
        </div>

        {authority?.canSendNormal ? (
          <form className="flex items-end gap-2 border-t bg-card px-3 py-3 sm:px-4" onSubmit={handleSend}>
            <label className="sr-only" htmlFor="conversation-message">
              Nội dung tin nhắn
            </label>
            <textarea
              className="max-h-28 min-h-10 flex-1 resize-none rounded-full border bg-secondary/40 px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={busy}
              id="conversation-message"
              maxLength={10000}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Aa"
              rows={1}
              value={content}
            />
            <Button
              aria-label="Gửi tin nhắn"
              className="size-10 shrink-0 rounded-full p-0"
              disabled={busy || !content.trim()}
              size="icon"
              type="submit"
            >
              {busy ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Send aria-hidden="true" className="size-4" />
              )}
            </Button>
          </form>
        ) : null}

        {!loading && !error && !missing && authority && !authority.canSendNormal ? (
          <p className="border-t px-4 py-3 text-xs text-muted-foreground">
            Hiện bạn chỉ có thể xem hội thoại, chưa gửi thêm tin nhắn.
          </p>
        ) : null}
      </div>
    </section>
  )
}

export default ApplicationConversationPanel
