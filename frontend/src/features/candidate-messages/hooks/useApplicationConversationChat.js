import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  getOwnApplicationConversationApi,
  sendOwnApplicationConversationMessageApi,
} from '@/apis/application.api'
import { subscribeRealtimeEvent } from '@/socket/realtime-subscriptions'
import { REALTIME_EVENT } from '@/utils/constant'

import {
  appendUniqueMessage,
  isConversationMissingError,
} from '../utils'

function useApplicationConversationChat(applicationId) {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({
    key: null,
    messages: [],
    conversation: null,
    authority: null,
    missing: false,
    error: null,
  })
  const [draftByApplicationId, setDraftByApplicationId] = useState({})
  const [sending, setSending] = useState(false)
  const nearBottomRef = useRef(true)

  const draft = applicationId ? (draftByApplicationId[applicationId] ?? '') : ''

  const setDraft = useCallback(
    (value) => {
      if (!applicationId) {
        return
      }
      setDraftByApplicationId((current) => ({
        ...current,
        [applicationId]: typeof value === 'function' ? value(current[applicationId] ?? '') : value,
      }))
    },
    [applicationId],
  )

  useEffect(() => {
    if (!applicationId) {
      return undefined
    }

    let active = true
    const key = String(loadAttempt)
    nearBottomRef.current = true

    getOwnApplicationConversationApi(applicationId).then(
      (response) => {
        if (!active) {
          return
        }
        setView({
          key,
          messages: response.messages ?? [],
          conversation: response.conversation ?? null,
          authority: response.authority ?? null,
          missing: false,
          error: null,
        })
      },
      (error) => {
        if (!active) {
          return
        }
        if (isConversationMissingError(error)) {
          setView({
            key,
            messages: [],
            conversation: null,
            authority: null,
            missing: true,
            error: null,
          })
          return
        }
        setView({
          key,
          messages: [],
          conversation: null,
          authority: null,
          missing: false,
          error,
        })
      },
    )

    return () => {
      active = false
    }
  }, [applicationId, loadAttempt])

  useEffect(() => {
    if (!applicationId) {
      return undefined
    }

    const unsubscribeMessage = subscribeRealtimeEvent(REALTIME_EVENT.MESSAGE, (payload) => {
      if (payload?.applicationId !== applicationId || !payload?.message) {
        return
      }
      setView((current) => ({
        ...current,
        messages: appendUniqueMessage(current.messages, payload.message),
      }))
    })

    const unsubscribeState = subscribeRealtimeEvent(
      REALTIME_EVENT.CONVERSATION_STATE,
      (payload) => {
        if (payload?.applicationId !== applicationId) {
          return
        }
        setLoadAttempt((current) => current + 1)
      },
    )

    return () => {
      unsubscribeMessage()
      unsubscribeState()
    }
  }, [applicationId])

  const reload = useCallback(() => {
    setLoadAttempt((current) => current + 1)
  }, [])

  const sendMessage = useCallback(async () => {
    const trimmed = draft.trim()
    if (!applicationId || !trimmed || sending) {
      return false
    }

    setSending(true)
    try {
      const response = await sendOwnApplicationConversationMessageApi(applicationId, trimmed)
      setDraft('')
      setView((current) => ({
        ...current,
        messages: response.message
          ? appendUniqueMessage(current.messages, response.message)
          : current.messages,
        conversation: response.conversation ?? current.conversation,
        authority: response.authority ?? current.authority,
        missing: false,
      }))
      nearBottomRef.current = true
      return true
    } catch (error) {
      toast.error(error.message || 'Không gửi được tin nhắn.')
      return false
    } finally {
      setSending(false)
    }
  }, [applicationId, draft, sending, setDraft])

  const missingApplicationId = !applicationId

  return {
    loading: missingApplicationId ? false : view.key !== String(loadAttempt),
    messages: missingApplicationId ? [] : view.messages,
    conversation: missingApplicationId ? null : view.conversation,
    authority: missingApplicationId ? null : view.authority,
    missing: missingApplicationId ? false : view.missing,
    error: missingApplicationId
      ? new Error('Thiếu mã đơn ứng tuyển.')
      : view.error,
    draft,
    setDraft,
    sending,
    reload,
    sendMessage,
    nearBottomRef,
  }
}

export default useApplicationConversationChat
