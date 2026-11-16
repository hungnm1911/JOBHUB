import { ArrowDown, CircleX, LoaderCircle, MessageSquare, RotateCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import { selectAuthenticatedUser } from '@/features/authentication/slice'
import { useAppSelector } from '@/store/hooks'

import useApplicationConversationChat from '../hooks/useApplicationConversationChat'
import { buildMessageTimeline, CONVERSATION_MODE, CONVERSATION_MODE_LABEL } from '../utils'
import ChatHeader from './ChatHeader'
import DateSeparator from './DateSeparator'
import MessageBubble from './MessageBubble'
import MessageComposer from './MessageComposer'

function ChatPanel({ application, onBack = null, onConversationUpdated = null }) {
  const user = useAppSelector(selectAuthenticatedUser)
  const applicationId = application?.id
  const {
    loading,
    messages,
    conversation,
    authority,
    missing,
    error,
    draft,
    setDraft,
    sending,
    reload,
    sendMessage,
    nearBottomRef,
  } = useApplicationConversationChat(applicationId)

  const listRef = useRef(null)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const recruiter = application?.assignedRecruiter
  const mode = conversation?.mode ?? (missing ? CONVERSATION_MODE.NOT_CREATED : null)
  const timeline = useMemo(
    () => buildMessageTimeline(messages, user?.id),
    [messages, user?.id],
  )

  useEffect(() => {
    if (!listRef.current || !nearBottomRef.current) {
      return undefined
    }

    const node = listRef.current
    const scrollToBottom = () => {
      node.scrollTop = node.scrollHeight
    }

    scrollToBottom()
    const frame = requestAnimationFrame(() => {
      scrollToBottom()
      setShowJumpToLatest(false)
    })

    return () => cancelAnimationFrame(frame)
  }, [applicationId, messages, loading, nearBottomRef])

  useEffect(() => {
    if (!onConversationUpdated || loading || !applicationId) {
      return
    }
    onConversationUpdated({
      applicationId,
      messages,
      conversation,
      authority,
      missing,
      mode,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional list preview sync
  }, [loading, applicationId, messages, conversation, authority, missing, mode])

  const handleScroll = () => {
    const node = listRef.current
    if (!node) {
      return
    }
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight
    const nearBottom = distance < 96
    nearBottomRef.current = nearBottom
    setShowJumpToLatest(!nearBottom && messages.length > 0)
  }

  const jumpToLatest = () => {
    const node = listRef.current
    if (!node) {
      return
    }
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
    nearBottomRef.current = true
    setShowJumpToLatest(false)
  }

  const canSend = authority?.canSendNormal === true
  const readOnlyHint = missing
    ? 'Hội thoại chưa được mở. Hệ thống tạo hội thoại khi nhà tuyển dụng nhận phụ trách đơn của bạn.'
    : !loading && !error && authority && !canSend
      ? mode
        ? `${CONVERSATION_MODE_LABEL[mode] ?? mode}. Bạn chỉ có thể xem lịch sử tin nhắn.`
        : 'Hiện bạn chỉ có thể xem hội thoại, chưa gửi thêm tin nhắn.'
      : !loading && !error && !missing && !authority
        ? 'Không xác định được quyền gửi tin. Thử tải lại hội thoại.'
        : null

  if (!application) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-muted/20 p-6">
        <CenteredState
          description="Chọn một hội thoại ở danh sách bên trái để xem và gửi tin nhắn."
          icon={MessageSquare}
          title="Chọn hội thoại"
          tone="bg-secondary text-muted-foreground"
        />
      </div>
    )
  }

  return (
    <section className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background">
      <ChatHeader application={application} mode={mode} onBack={onBack} />

      <div className="relative min-h-0 flex-1">
        <div
          className="absolute inset-0 overflow-y-auto bg-[linear-gradient(180deg,color-mix(in_oklch,var(--muted)_35%,transparent),transparent_180px)]"
          onScroll={handleScroll}
          ref={listRef}
        >
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end py-2.5">
            {loading ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                Đang tải hội thoại…
              </div>
            ) : null}

            {!loading && error ? (
              <div className="flex flex-1 items-center justify-center p-4">
                <CenteredState
                  action={
                    <Button onClick={reload} size="sm" type="button" variant="outline">
                      <RotateCw aria-hidden="true" className="size-4" />
                      Thử lại
                    </Button>
                  }
                  description={error.message || 'Không tải được hội thoại.'}
                  icon={CircleX}
                  title="Không tải được tin nhắn"
                  tone="bg-secondary text-muted-foreground"
                />
              </div>
            ) : null}

            {!loading && !error && missing ? (
              <div className="flex flex-1 items-center justify-center px-6">
                <div className="max-w-md rounded-2xl border bg-card px-5 py-6 text-center shadow-sm">
                  <MessageSquare
                    aria-hidden="true"
                    className="mx-auto size-8 text-muted-foreground"
                  />
                  <p className="mt-3 text-sm font-medium">Hội thoại chưa được mở</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Khi nhà tuyển dụng nhận phụ trách đơn, bạn có thể trao đổi tại đây.
                  </p>
                </div>
              </div>
            ) : null}

            {!loading && !error && !missing && messages.length === 0 ? (
              <div className="flex flex-1 items-center justify-center px-6">
                <div className="max-w-md rounded-2xl border bg-card px-5 py-6 text-center shadow-sm">
                  <MessageSquare
                    aria-hidden="true"
                    className="mx-auto size-8 text-primary"
                  />
                  <p className="mt-3 text-sm font-medium">Chưa có tin nhắn</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {canSend
                      ? 'Hãy gửi lời chào để bắt đầu trao đổi với nhà tuyển dụng.'
                      : 'Chưa có nội dung trong hội thoại này.'}
                  </p>
                </div>
              </div>
            ) : null}

            {!loading && !error && !missing && messages.length > 0 ? (
              <ul className="mt-auto pb-2">
                {timeline.map((item) => {
                  if (item.kind === 'separator') {
                    return <DateSeparator key={item.id} label={item.label} />
                  }
                  return (
                    <MessageBubble
                      key={item.id}
                      message={item.message}
                      recruiterAvatarUrl={recruiter?.avatarUrl}
                      recruiterName={recruiter?.fullName}
                      showAvatar={item.showAvatar}
                      showSenderMeta={item.showSenderMeta}
                      side={item.side}
                      tightTop={item.tightTop}
                    />
                  )
                })}
              </ul>
            ) : null}
          </div>
        </div>

        {showJumpToLatest ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <Button
              className="pointer-events-auto rounded-full shadow-md"
              onClick={jumpToLatest}
              size="sm"
              type="button"
              variant="secondary"
            >
              <ArrowDown aria-hidden="true" className="size-4" />
              Tin mới nhất
            </Button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="shrink-0 border-t bg-card px-3 py-2.5 text-xs text-muted-foreground sm:px-4">
          Đang kiểm tra quyền gửi tin…
        </div>
      ) : canSend ? (
        <MessageComposer
          autoFocus
          focusKey={applicationId}
          onChange={setDraft}
          onSend={sendMessage}
          sending={sending}
          value={draft}
        />
      ) : (
        <MessageComposer
          onChange={setDraft}
          onSend={sendMessage}
          readOnlyHint={readOnlyHint}
          value={draft}
        />
      )}
    </section>
  )
}

export default ChatPanel
