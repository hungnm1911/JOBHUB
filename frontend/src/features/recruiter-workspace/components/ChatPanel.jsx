import { MessageSquare } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ErrorState, ListSkeleton, StateMessage } from '@/components/common/ListStates'
import { Button } from '@/components/ui/button'
import DateSeparator from '@/features/candidate-messages/components/DateSeparator'
import MessageBubble from '@/features/candidate-messages/components/MessageBubble'
import MessageComposer from '@/features/candidate-messages/components/MessageComposer'
import { CONVERSATION_MODE, buildMessageTimeline } from '@/features/candidate-messages/utils'
import { selectAuthenticatedUser } from '@/features/authentication/slice'
import { cn } from '@/lib/utils'
import { useAppSelector } from '@/store/hooks'

import { useDebouncedValue } from '../hooks/useListSearch'
import useRecruiterConversation from '../hooks/useRecruiterConversation'
import { toRecruiterErrorMessage } from '../utils'
import { SearchInput } from './Panel'

const MODE_BANNER = Object.freeze({
  [CONVERSATION_MODE.PAUSED_UNASSIGNED]:
    'Cuộc trò chuyện tạm dừng vì hồ sơ chưa được phân công.',
  [CONVERSATION_MODE.READ_ONLY]: 'Hồ sơ đã kết thúc, cuộc trò chuyện chỉ có thể xem.',
  [CONVERSATION_MODE.FROZEN_COMPANY]:
    'Doanh nghiệp đang bị khóa, cuộc trò chuyện chỉ có thể xem.',
  [CONVERSATION_MODE.ELIGIBILITY_LOSS_WINDOW]:
    'Quyền nhắn tin đang tạm khóa do điều kiện của người xử lý đã thay đổi.',
  [CONVERSATION_MODE.NOT_CREATED]: 'Cuộc trò chuyện chưa được mở.',
})

function ChatPanel({ applicationId, candidate, className }) {
  const user = useAppSelector(selectAuthenticatedUser)
  const [keyword, setKeyword] = useState('')
  const [draft, setDraft] = useState('')
  const q = useDebouncedValue(keyword.trim())
  const chat = useRecruiterConversation(applicationId, q)
  const scrollRef = useRef(null)
  const lastId = chat.messages.at(-1)?.id

  // Follow new messages; loading older ones keeps the reading position.
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [lastId])

  const send = async () => {
    try {
      await chat.send(draft.trim())
      setDraft('')
    } catch (error) {
      toast.error(toRecruiterErrorMessage(error, 'Không gửi được tin nhắn.'))
    }
  }

  let body
  if (chat.loading) body = <ListSkeleton label="Đang tải hội thoại" rows={3} />
  else if (chat.error) {
    body = (
      <ErrorState
        error={chat.error}
        forbiddenDescription="Chỉ người đang (hoặc cuối cùng) xử lý hồ sơ xem được hội thoại này."
        onRetry={chat.reload}
      />
    )
  } else if (chat.missing || chat.messages.length === 0) {
    body = (
      <StateMessage
        description={
          q ? 'Không có tin nhắn nào khớp.' : chat.missing ? MODE_BANNER.NOT_CREATED : 'Chưa có tin nhắn.'
        }
        icon={MessageSquare}
        title="Không có tin nhắn"
      />
    )
  } else {
    body = (
      <ul className="py-3">
        {chat.hasOlder && (
          <li className="flex justify-center pb-2">
            <Button
              disabled={chat.loadingOlder}
              onClick={() => chat.loadOlder().catch(() => toast.error('Không tải được tin cũ hơn.'))}
              size="sm"
              type="button"
              variant="outline"
            >
              Tải tin cũ hơn
            </Button>
          </li>
        )}
        {buildMessageTimeline(chat.messages, user?.id).map((item) =>
          item.kind === 'separator' ? (
            <DateSeparator key={item.id} label={item.label} />
          ) : (
            <MessageBubble
              key={item.id}
              message={item.message}
              recruiterAvatarUrl={candidate?.avatarUrl}
              recruiterName={candidate?.fullName ?? 'Ứng viên'}
              showAvatar={item.showAvatar}
              showSenderMeta={item.showSenderMeta}
              side={item.side}
              tightTop={item.tightTop}
            />
          ),
        )}
      </ul>
    )
  }

  const canSend = chat.authority?.canSendNormal === true
  const banner = !chat.loading && !chat.error ? MODE_BANNER[chat.mode] : null

  return (
    <section
      aria-label="Trò chuyện với ứng viên"
      className={cn('flex h-[70svh] min-h-96 flex-col overflow-hidden rounded-xl border bg-card', className)}
    >
      <div className="flex shrink-0 items-center gap-3 border-b px-3 py-2">
        <h2 className="min-w-0 truncate text-sm font-semibold">
          {candidate?.fullName ?? 'Trò chuyện'}
        </h2>
        <SearchInput label="Tìm trong hội thoại" onChange={setKeyword} value={keyword} />
      </div>
      {banner && <p className="shrink-0 border-b bg-warning/10 px-3 py-2 text-sm">{banner}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto bg-background" ref={scrollRef}>
        {body}
      </div>
      {canSend && (
        <MessageComposer onChange={setDraft} onSend={send} sending={chat.sending} value={draft} />
      )}
    </section>
  )
}

export default ChatPanel
