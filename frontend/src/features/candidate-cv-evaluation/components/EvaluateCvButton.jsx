import { FileSearch } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { toLoginNavigationState } from '@/features/authentication/utils'
import { USER_ROLE } from '@/utils/constant'

import JobCvEvaluationDialog from './JobCvEvaluationDialog'

function EvaluateCvButton({ jobId, jobTitle, viewer }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const isGuest = !viewer.role

  if (!viewer.resolved || (viewer.role && viewer.role !== USER_ROLE.CANDIDATE)) {
    return null
  }

  const handleClick = (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (isGuest) {
      navigate('/login', {
        state: toLoginNavigationState(location),
      })
      return
    }

    setOpen(true)
  }

  return (
    <>
      <Button
        aria-label={
          isGuest ? 'Đăng nhập để đánh giá CV với AI' : `Đánh giá CV với AI cho ${jobTitle}`
        }
        className="relative z-10 h-9 px-3 text-xs font-semibold"
        onClick={handleClick}
        size="sm"
        title={isGuest ? 'Hãy đăng nhập để đánh giá CV với AI' : 'Đánh giá CV với AI'}
        type="button"
        variant="outline"
      >
        <FileSearch aria-hidden="true" className="size-4" />
        Đánh giá CV với AI
      </Button>

      {open && (
        <JobCvEvaluationDialog
          jobId={jobId}
          jobTitle={jobTitle}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

export default EvaluateCvButton
