import { useCallback, useEffect, useState } from 'react'

import {
  getMyApplicationConversationApi,
  sendMyApplicationMessageApi,
} from '@/apis/recruiter-application.api'
import { isConversationMissingError } from '@/features/candidate-messages/utils'
import { subscribeRealtimeEvent } from '@/socket/realtime-subscriptions'
import { REALTIME_EVENT, SOCKET_LIFECYCLE_EVENT } from '@/utils/constant'

const PAGE_SIZE = 50

function mergeMessages(current, incoming) {
  const byId = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) byId.set(message.id, message)
  return [...byId.values()].sort(
    (left, right) =>
      new Date(left.createdAt) - new Date(right.createdAt) || left.id.localeCompare(right.id),
  )
}

// V11: newest page first, older pages on demand. Realtime events only add the pushed
// Message or trigger a re-read of the authoritative conversation.
function useRecruiterConversation(applicationId, keyword) {
  const key = `${applicationId}|${keyword}`
  const [version, setVersion] = useState(0)
  const [view, setView] = useState({ key: null, messages: [] })
  const [sending, setSending] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)

  const fetchPage = useCallback(
    (page) =>
      getMyApplicationConversationApi(applicationId, {
        page,
        limit: PAGE_SIZE,
        sort: '-createdAt',
        ...(keyword ? { q: keyword } : {}),
      }),
    [applicationId, keyword],
  )

  useEffect(() => {
    let active = true
    fetchPage(1).then(
      (data) => {
        if (!active) return
        setView((current) => ({
          key,
          messages: mergeMessages(current.key === key ? current.messages : [], data.messages ?? []),
          authority: data.authority,
          mode: data.conversation?.mode,
          totalPages: data.pagination?.totalPages ?? 1,
          page: current.key === key ? current.page : 1,
          error: null,
          missing: false,
        }))
      },
      (error) => {
        if (!active) return
        const missing = isConversationMissingError(error)
        setView({ key, messages: [], error: missing ? null : error, missing })
      },
    )
    return () => {
      active = false
    }
  }, [fetchPage, key, version])

  useEffect(() => {
    const reload = () => setVersion((current) => current + 1)
    const offMessage = subscribeRealtimeEvent(REALTIME_EVENT.MESSAGE, (payload) => {
      if (payload?.applicationId !== applicationId || !payload.message) return
      if (keyword) return
      setView((current) => ({
        ...current,
        messages: mergeMessages(current.messages, [payload.message]),
      }))
    })
    const offState = subscribeRealtimeEvent(REALTIME_EVENT.CONVERSATION_STATE, (payload) => {
      if (payload?.applicationId === applicationId) reload()
    })
    const offConnect = subscribeRealtimeEvent(SOCKET_LIFECYCLE_EVENT.CONNECT, reload)
    return () => {
      offMessage()
      offState()
      offConnect()
    }
  }, [applicationId, keyword])

  const loadOlder = async () => {
    setLoadingOlder(true)
    try {
      const nextPage = (view.page ?? 1) + 1
      const data = await fetchPage(nextPage)
      setView((current) => ({
        ...current,
        page: nextPage,
        messages: mergeMessages(current.messages, data.messages ?? []),
      }))
    } finally {
      setLoadingOlder(false)
    }
  }

  // Returns true when sent; the caller keeps the draft otherwise.
  const send = async (content) => {
    setSending(true)
    try {
      await sendMyApplicationMessageApi(applicationId, content)
      return true
    } finally {
      setSending(false)
      setVersion((current) => current + 1)
    }
  }

  const current = view.key === key

  return {
    loading: !current,
    messages: current ? view.messages : [],
    authority: current ? view.authority : null,
    mode: current ? view.mode : null,
    missing: current && view.missing,
    error: current ? view.error : null,
    hasOlder: current && (view.page ?? 1) < (view.totalPages ?? 1),
    loadingOlder,
    loadOlder,
    sending,
    send,
    reload: () => setVersion((value) => value + 1),
  }
}

export default useRecruiterConversation
