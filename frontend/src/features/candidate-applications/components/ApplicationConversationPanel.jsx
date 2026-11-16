import { LoaderCircle, MessageSquare, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import {
  getOwnApplicationConversationApi,
  sendOwnApplicationConversationMessageApi,
} from '@/apis/application.api'
import { Button } from '@/components/ui/button'

import { formatDateTime } from '../utils'

function isConversationMissingError(error) {
  return (
    error?.status === 404 &&
    typeof error?.message === 'string' &&
    /conversation not found/i.test(error.message)
  )
}

function messageSenderLabel(message, currentUserId) {
  if (message.type === 'SYSTEM') {
    return 'Hệ thống'
  }
  if (message.senderUserId && currentUserId && message.senderUserId === currentUserId) {
    return 'Bạn'
  }
  if (message.senderCompanyMemberId) {
    return 'Nhà tuyển dụng'
  }
  return 'Tin nhắn'
}

function ApplicationConversationPanel({ applicationId, open, onClose, currentUserId = null }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [missing, setMissing] = useState(false)
  const [messages, setMessages] = useState([])
  const [authority, setAuthority] = useState(null)
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    let active = true
    setLoading(true)
    setError(null)
    setMissing(false)

    getOwnApplicationConversationApi(applicationId).then(
      (response) => {
        if (!active) {
          return
        }
        setMessages(response.messages ?? [])
        setAuthority(response.authority ?? null)
        setMissing(false)
        setLoading(false)
      },
      (loadError) => {
        if (!active) {
          return
        }
        setLoading(false)
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
  }, [applicationId, open, reloadKey])

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
      toast.success('Đã gửi tin nhắn')
    } catch (sendError) {
      toast.error(sendError.message || 'Không gửi được tin nhắn.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="conversation-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
        <Button onClick={onClose} size="sm" type="button" variant="ghost">
          Thu gọn
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Đang tải hội thoại…
          </div>
        ) : null}

        {error ? (
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
          <p className="rounded-lg bg-secondary/50 px-3 py-3 text-sm text-muted-foreground">
            Hội thoại chưa được mở. Hệ thống tạo hội thoại khi nhà tuyển dụng nhận phụ trách đơn
            ứng tuyển.
          </p>
        ) : null}

        {!loading && !error && !missing && messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có tin nhắn nào.</p>
        ) : null}

        {!loading && !error && !missing && messages.length > 0 ? (
          <ul className="max-h-72 space-y-2 overflow-y-auto rounded-lg border bg-secondary/30 p-3">
            {messages.map((message) => (
              <li className="rounded-lg bg-card px-3 py-2 text-sm shadow-sm" key={message.id}>
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {messageSenderLabel(message, currentUserId)}
                  {formatDateTime(message.createdAt)
                    ? ` · ${formatDateTime(message.createdAt)}`
                    : null}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {authority?.canSendNormal ? (
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSend}>
            <label className="sr-only" htmlFor="conversation-message">
              Nội dung tin nhắn
            </label>
            <textarea
              className="min-h-20 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={busy}
              id="conversation-message"
              maxLength={10000}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Nhập tin nhắn…"
              value={content}
            />
            <Button className="self-end" disabled={busy || !content.trim()} type="submit">
              {busy ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Send aria-hidden="true" className="size-4" />
              )}
              Gửi
            </Button>
          </form>
        ) : null}

        {!loading && !error && !missing && authority && !authority.canSendNormal ? (
          <p className="text-xs text-muted-foreground">
            Hiện bạn chỉ có thể xem hội thoại, chưa gửi thêm tin nhắn.
          </p>
        ) : null}
      </div>
    </section>
  )
}

export default ApplicationConversationPanel
