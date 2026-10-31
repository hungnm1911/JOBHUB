import { Heart } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { saveJobApi, unsaveJobApi } from '@/apis/saved-job.api'
import usePostLoginIntent from '@/features/authentication/hooks/usePostLoginIntent'
import { POST_LOGIN_INTENT, toLoginNavigationState } from '@/features/authentication/utils'
import { cn } from '@/lib/utils'
import { USER_ROLE } from '@/utils/constant'

// V16: only Candidates own Saved Jobs; guests are invited to sign in and other roles see nothing.
function SaveJobButton({ jobId, jobTitle, initialSaved, viewer, className }) {
  const location = useLocation()
  const navigate = useNavigate()
  const resumeSave = usePostLoginIntent(POST_LOGIN_INTENT.SAVE_JOB, jobId)
  const isGuest = !viewer.role
  // Guests never have Saved Jobs state (V16); keep local saved only for Candidates.
  const [saved, setSaved] = useState(() => (!isGuest && Boolean(initialSaved)))
  const [syncedInitial, setSyncedInitial] = useState(initialSaved)
  const [syncedViewerKey, setSyncedViewerKey] = useState(viewer.userId ?? null)
  const [pending, setPending] = useState(false)
  const resumedSaveRef = useRef(false)
  const viewerKey = viewer.userId ?? null

  if (syncedViewerKey !== viewerKey) {
    setSyncedViewerKey(viewerKey)
    setSaved(!isGuest && Boolean(initialSaved))
    setSyncedInitial(initialSaved)
  } else if (syncedInitial !== initialSaved) {
    setSyncedInitial(initialSaved)
    if (!isGuest) {
      setSaved(Boolean(initialSaved))
    }
  }

  useEffect(() => {
    resumedSaveRef.current = false
  }, [viewerKey])

  useEffect(() => {
    if (!resumeSave || !viewer.resolved || isGuest || saved || resumedSaveRef.current) {
      return undefined
    }

    resumedSaveRef.current = true
    let cancelled = false
    setSaved(true)
    setPending(true)

    saveJobApi(jobId).then(
      () => {
        if (!cancelled) {
          setPending(false)
          toast.success('Đã lưu việc làm')
        }
      },
      (error) => {
        if (!cancelled) {
          setSaved(false)
          setPending(false)
          toast.error(error.message)
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [resumeSave, viewer.resolved, isGuest, saved, jobId])

  if (!viewer.resolved || (viewer.role && viewer.role !== USER_ROLE.CANDIDATE)) {
    return null
  }

  const showSaved = !isGuest && saved
  const label = isGuest
    ? 'Đăng nhập để lưu việc làm'
    : showSaved
      ? `Bỏ lưu việc làm ${jobTitle}`
      : `Lưu việc làm ${jobTitle}`

  const handleClick = async (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (isGuest) {
      navigate('/login', {
        state: toLoginNavigationState(location, { type: POST_LOGIN_INTENT.SAVE_JOB, jobId }),
      })
      return
    }

    const nextSaved = !saved
    setSaved(nextSaved)
    setPending(true)

    try {
      await (nextSaved ? saveJobApi(jobId) : unsaveJobApi(jobId))
      toast.success(nextSaved ? 'Đã lưu việc làm' : 'Đã bỏ lưu việc làm')
    } catch (error) {
      setSaved(!nextSaved)
      toast.error(error.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      aria-label={label}
      aria-pressed={isGuest ? undefined : showSaved}
      className={cn(
        'relative z-10 inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-card text-primary transition-colors outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
        showSaved && 'border-primary/40 bg-primary/10',
        className,
      )}
      disabled={pending}
      onClick={handleClick}
      title={isGuest ? 'Hãy đăng nhập để lưu tin' : showSaved ? 'Bỏ lưu' : 'Lưu tin'}
      type="button"
    >
      <Heart
        aria-hidden="true"
        className={cn('size-4 transition-transform', showSaved && 'scale-110 fill-current')}
      />
    </button>
  )
}

export default SaveJobButton
