import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { directApplyApi } from '@/apis/application.api'
import { Button } from '@/components/ui/button'
import usePostLoginIntent from '@/features/authentication/hooks/usePostLoginIntent'
import { POST_LOGIN_INTENT, toLoginNavigationState } from '@/features/authentication/utils'
import { cn } from '@/lib/utils'
import { API_ERROR_MESSAGE, USER_ROLE } from '@/utils/constant'

import ApplyJobDialog from './ApplyJobDialog'

function toApplyErrorMessage(error) {
  if (error?.status === 409) {
    return API_ERROR_MESSAGE.APPLICATION_ALREADY_EXISTS
  }

  if (error?.status === 404) {
    return API_ERROR_MESSAGE.JOB_NOT_ACCEPTING_APPLICATIONS
  }

  return error?.message ?? API_ERROR_MESSAGE.UNEXPECTED
}

function ApplyJobButton({ jobId, jobTitle, acceptingApplications = true, viewer, revealOnHover = false }) {
  const location = useLocation()
  const navigate = useNavigate()
  const resumeApply = usePostLoginIntent(POST_LOGIN_INTENT.APPLY_JOB, jobId)
  const [requestedOpen, setRequestedOpen] = useState(false)
  const [dismissedResume, setDismissedResume] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const isGuest = !viewer.role
  const open = requestedOpen || (resumeApply && viewer.resolved && !isGuest && !dismissedResume)

  if (!viewer.resolved || (viewer.role && viewer.role !== USER_ROLE.CANDIDATE) || !acceptingApplications) {
    return null
  }

  const handleClick = (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (isGuest) {
      navigate('/login', {
        state: toLoginNavigationState(location, { type: POST_LOGIN_INTENT.APPLY_JOB, jobId }),
      })
      return
    }

    setError(null)
    setRequestedOpen(true)
  }

  const handleConfirm = async (candidateCvId) => {
    setSubmitting(true)
    setError(null)

    try {
      await directApplyApi({ jobId, candidateCvId })
      setRequestedOpen(false)
      setDismissedResume(true)
      toast.success('Đã gửi hồ sơ ứng tuyển')
    } catch (applyError) {
      setError(toApplyErrorMessage(applyError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        aria-label={isGuest ? 'Đăng nhập để ứng tuyển' : `Ứng tuyển ${jobTitle}`}
        className={cn(
          'relative z-10 h-9 px-3 text-xs font-semibold',
          revealOnHover &&
            'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100',
        )}
        onClick={handleClick}
        size="sm"
        title={isGuest ? 'Hãy đăng nhập để ứng tuyển' : 'Ứng tuyển'}
        type="button"
      >
        Ứng tuyển
      </Button>

      {open && (
        <ApplyJobDialog
          error={error}
          jobTitle={jobTitle}
          onClose={() => {
            if (!submitting) {
              setRequestedOpen(false)
              setDismissedResume(true)
            }
          }}
          onConfirm={handleConfirm}
          submitting={submitting}
        />
      )}
    </>
  )
}

export default ApplyJobButton
