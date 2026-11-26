import { ArrowLeft, MessageSquare } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { listMyConversationsApi } from '@/apis/recruiter-application.api'
import { listRecruiterJobsApi } from '@/apis/recruiter-job.api'
import { ErrorState, ListSkeleton, Pager, StateMessage } from '@/components/common/ListStates'
import { Button } from '@/components/ui/button'
import { SelectDropdown } from '@/components/ui/select-dropdown'
import {
  CONVERSATION_MODE,
  CONVERSATION_MODE_LABEL,
  formatConversationListTime,
} from '@/features/candidate-messages/utils'
import { cn } from '@/lib/utils'
import { subscribeRealtimeEvent } from '@/socket/realtime-subscriptions'
import { REALTIME_EVENT, SOCKET_LIFECYCLE_EVENT } from '@/utils/constant'

import useListSearch, { toListQuery, useDebouncedValue } from '../hooks/useListSearch'
import useResource from '../hooks/useResource'
import { JOB_LIST_SCOPE } from '../utils'
import ChatPanel from './ChatPanel'
import { Avatar, SearchInput } from './Panel'

const MODES = [
  CONVERSATION_MODE.ACTIVE,
  CONVERSATION_MODE.READ_ONLY,
  CONVERSATION_MODE.FROZEN_COMPANY,
]
const SORT_OPTIONS = [
  { value: '-lastMessageAt', label: 'Tin mới nhất' },
  { value: 'lastMessageAt', label: 'Tin cũ nhất' },
  { value: '-createdAt', label: 'Mở gần đây' },
  { value: 'createdAt', label: 'Mở lâu nhất' },
]
const SEARCH_SPEC = Object.freeze({
  q: 'text',
  jobId: 'id',
  mode: ['', ...MODES],
  sort: SORT_OPTIONS.map((option) => option.value),
})
const JOB_OPTION_QUERY = Object.freeze({ scope: JOB_LIST_SCOPE.MY_TEAM, sort: 'title', limit: 100 })

function ConversationInbox() {
  const [searchParams] = useSearchParams()
  const selected = searchParams.get('application')
  const { search, setFilters, setPage } = useListSearch(SEARCH_SPEC)
  const keyword = useDebouncedValue(search.q)
  const query = useMemo(() => toListQuery({ ...search, q: keyword }), [search, keyword])
  const { data, loading, error, reload } = useResource(listMyConversationsApi, query)
  const jobs = useResource(listRecruiterJobsApi, JOB_OPTION_QUERY)
  const conversations = data?.conversations ?? []
  const active = conversations.find((item) => item.applicationId === selected)

  useEffect(() => {
    const offs = [
      REALTIME_EVENT.MESSAGE,
      REALTIME_EVENT.CONVERSATION_STATE,
      SOCKET_LIFECYCLE_EVENT.CONNECT,
    ].map((eventName) => subscribeRealtimeEvent(eventName, reload))
    return () => offs.forEach((off) => off())
  }, [reload])

  const linkFor = (applicationId) => {
    const params = new URLSearchParams(searchParams)
    params.set('application', applicationId)
    return `?${params}`
  }

  let list
  if (loading) list = <ListSkeleton label="Đang tải cuộc trò chuyện" />
  else if (error) list = <ErrorState error={error} onRetry={reload} />
  else if (conversations.length === 0) {
    list = (
      <StateMessage
        description="Cuộc trò chuyện xuất hiện khi hồ sơ được giao cho bạn."
        icon={MessageSquare}
        title="Không có cuộc trò chuyện"
      />
    )
  } else {
    list = (
      <>
        <ul className="divide-y">
          {conversations.map((item) => (
            <li key={item.id}>
              <Link
                aria-current={item.applicationId === selected ? 'true' : undefined}
                className={cn(
                  'flex gap-3 px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  item.applicationId === selected ? 'bg-primary/10' : 'hover:bg-secondary/60',
                )}
                to={linkFor(item.applicationId)}
              >
                <Avatar person={item.candidate} />
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {item.candidate?.fullName ?? 'Ứng viên'}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatConversationListTime(item.lastMessageAt)}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{item.job?.title}</span>
                  <span className="block truncate text-sm">
                    {item.lastMessage?.content ?? 'Chưa có tin nhắn'}
                  </span>
                  {item.mode !== CONVERSATION_MODE.ACTIVE && (
                    <span className="text-xs text-muted-foreground">
                      {CONVERSATION_MODE_LABEL[item.mode] ?? item.mode}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Pager onPageChange={setPage} pagination={data.pagination} unit="cuộc trò chuyện" />
      </>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
      <div className={cn('min-w-0 space-y-3', selected && 'hidden lg:block')}>
        <div className="space-y-2 rounded-xl border bg-card p-3">
          <SearchInput
            label="Tìm theo ứng viên hoặc Job"
            onChange={(q) => setFilters({ q })}
            value={search.q}
          />
          <SelectDropdown
            ariaLabel="Lọc theo Job"
            onChange={(jobId) => setFilters({ jobId })}
            options={[
              { value: '', label: 'Mọi Job' },
              ...(jobs.data?.jobs ?? []).map((job) => ({
                value: job.id,
                label: job.title || 'Chưa đặt tiêu đề',
              })),
            ]}
            searchable
            value={search.jobId}
          />
          <div className="grid grid-cols-2 gap-2">
            <SelectDropdown
              ariaLabel="Lọc theo chế độ"
              onChange={(mode) => setFilters({ mode })}
              options={[
                { value: '', label: 'Mọi chế độ' },
                ...MODES.map((value) => ({ value, label: CONVERSATION_MODE_LABEL[value] })),
              ]}
              value={search.mode}
            />
            <SelectDropdown
              ariaLabel="Sắp xếp"
              onChange={(sort) => setFilters({ sort })}
              options={SORT_OPTIONS}
              value={search.sort}
            />
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card">{list}</div>
      </div>

      <div className={cn('min-w-0 space-y-2', !selected && 'hidden lg:block')}>
        {selected ? (
          <>
            <div className="flex flex-wrap justify-between gap-2">
              <Button asChild className="lg:hidden" size="sm" variant="ghost">
                <Link to="/recruiter/messages">
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Danh sách
                </Link>
              </Button>
              <Button asChild className="ml-auto" size="sm" variant="outline">
                <Link to={`/recruiter/my-applications/${selected}`}>Xem hồ sơ</Link>
              </Button>
            </div>
            <ChatPanel applicationId={selected} candidate={active?.candidate} key={selected} />
          </>
        ) : (
          <div className="rounded-xl border bg-card">
            <StateMessage
              description="Chọn một cuộc trò chuyện ở danh sách bên trái."
              icon={MessageSquare}
              title="Chưa chọn cuộc trò chuyện"
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default ConversationInbox
