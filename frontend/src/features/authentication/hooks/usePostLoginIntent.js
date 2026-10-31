import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

function usePostLoginIntent(type, jobId) {
  const location = useLocation()
  const navigate = useNavigate()
  const intent = location.state?.intent
  const [resume] = useState(() => Boolean(intent?.type === type && intent?.jobId === jobId))

  useEffect(() => {
    if (!resume || !location.state?.intent) {
      return
    }

    const nextState = { ...location.state }
    delete nextState.intent
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: Object.keys(nextState).length > 0 ? nextState : null },
    )
  }, [resume, location.hash, location.pathname, location.search, location.state, navigate])

  return resume
}

export default usePostLoginIntent
