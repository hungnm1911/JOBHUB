import { CircleX, LoaderCircle, MessageSquare, RotateCw } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import useCandidateMessageThreads from '../hooks/useCandidateMessageThreads'
import { MESSAGE_LIST_FILTER, sortThreadsByActivity } from '../utils'
import ChatPanel from './ChatPanel'
import ConversationListPanel from './ConversationListPanel'

function CandidateMessenger() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { loading, threads, error, reload, patchThread } = useCandidateMessageThreads()
  const [searchInput, setSearchInput] = useState('')
  const [filter, setFilter] = useState(MESSAGE_LIST_FILTER.ALL)
  const [mobileShowChat, setMobileShowChat] = useState(Boolean(searchParams.get('applicationId')))

  const requestedApplicationId = searchParams.get('applicationId')
  const sortedThreads = useMemo(() => sortThreadsByActivity(threads), [threads])

  const selectedApplicationId = useMemo(() => {
    if (
      requestedApplicationId &&
      sortedThreads.some((thread) => thread.applicationId === requestedApplicationId)
    ) {
      return requestedApplicationId
    }
    return (
      sortedThreads.find((thread) => thread.hasConversation)?.applicationId ??
      sortedThreads[0]?.applicationId ??
      null
    )
  }, [requestedApplicationId, sortedThreads])

  const selectedThread = useMemo(
    () => sortedThreads.find((thread) => thread.applicationId === selectedApplicationId) ?? null,
    [sortedThreads, selectedApplicationId],
  )

  const handleSelect = (applicationId) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set('applicationId', applicationId)
        return next
      },
      { replace: true },
    )
    setMobileShowChat(true)
  }

  const handleConversationUpdated = useCallback(
    (payload) => {
      patchThread(payload.applicationId, (thread) => {
        const lastMessage =
          Array.isArray(payload.messages) && payload.messages.length > 0
            ? payload.messages[payload.messages.length - 1]
            : null
        return {
          ...thread,
          messages: payload.messages,
          conversation: payload.conversation,
          authority: payload.authority,
          missing: payload.missing,
          mode: payload.mode,
          lastMessage,
          lastActivityAt:
            lastMessage?.createdAt ??
            payload.conversation?.createdAt ??
            thread.lastActivityAt,
          canSend: payload.authority?.canSendNormal === true,
          canRead: payload.authority?.canRead === true || Boolean(payload.conversation),
          hasConversation: Boolean(payload.conversation) && !payload.missing,
          loadError: null,
        }
      })
    },
    [patchThread],
  )

  if (loading) {
    return (
      <div className="flex min-h-[min(32rem,70svh)] flex-1 items-center justify-center">
        <CenteredState
          icon={LoaderCircle}
          spinning
          title="Đang tải hộp thư…"
          tone="bg-primary/10 text-primary"
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[min(32rem,70svh)] flex-1 items-center justify-center p-6">
        <CenteredState
          action={
            <Button onClick={reload} variant="outline">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          }
          description={error.message || 'Không tải được danh sách hội thoại.'}
          icon={CircleX}
          title="Không tải được tin nhắn"
          tone="bg-secondary text-muted-foreground"
        />
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div className="flex min-h-[min(32rem,70svh)] flex-1 items-center justify-center p-6">
        <CenteredState
          action={
            <Button asChild variant="outline">
              <Link to="/candidate/applications">Xem đơn ứng tuyển</Link>
            </Button>
          }
          description="Khi bạn có đơn ứng tuyển và nhà tuyển dụng mở hội thoại, tin nhắn sẽ xuất hiện tại đây."
          icon={MessageSquare}
          title="Chưa có hội thoại"
          tone="bg-secondary text-muted-foreground"
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            'min-h-0 w-full shrink-0 lg:w-[20rem] xl:w-[22rem]',
            mobileShowChat ? 'hidden lg:flex lg:flex-col' : 'flex flex-col',
          )}
        >
          <ConversationListPanel
            filter={filter}
            onClearSearch={() => setSearchInput('')}
            onFilterChange={setFilter}
            onSearchInputChange={setSearchInput}
            onSelect={handleSelect}
            searchInput={searchInput}
            selectedApplicationId={selectedApplicationId}
            threads={sortedThreads}
          />
        </div>

        <div
          className={cn(
            'min-h-0 min-w-0 flex-1',
            mobileShowChat ? 'flex' : 'hidden lg:flex',
          )}
        >
          <ChatPanel
            application={selectedThread?.application ?? null}
            onBack={() => setMobileShowChat(false)}
            onConversationUpdated={handleConversationUpdated}
          />
        </div>
      </div>
    </div>
  )
}

export default CandidateMessenger
