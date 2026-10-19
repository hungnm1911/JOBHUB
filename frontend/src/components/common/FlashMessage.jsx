import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { FLASH_MESSAGE_CONFIG, FLASH_MESSAGE_TYPE } from '@/utils/constant'

const FLASH_STYLE = Object.freeze({
  [FLASH_MESSAGE_TYPE.SUCCESS]: {
    icon: CircleCheck,
    role: 'status',
    className: 'border-primary/30 bg-primary/5 text-primary',
  },
  [FLASH_MESSAGE_TYPE.INFO]: {
    icon: Info,
    role: 'status',
    className: 'border-border bg-secondary text-foreground',
  },
  [FLASH_MESSAGE_TYPE.ERROR]: {
    icon: CircleAlert,
    role: 'alert',
    className: 'border-destructive/30 bg-destructive/5 text-destructive',
  },
})

// Navigation sets `state.flash = { type, title, message }`; values must be
// structured-cloneable because React Router stores them in history state.
function FlashMessage() {
  const location = useLocation()
  const navigate = useNavigate()
  const incoming = location.state?.flash
  const [flash, setFlash] = useState(null)

  if (incoming && flash?.locationKey !== location.key) {
    setFlash({ ...incoming, locationKey: location.key, pathname: location.pathname })
  }

  useEffect(() => {
    if (!incoming) {
      return
    }

    const nextState = { ...location.state }
    delete nextState.flash
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: Object.keys(nextState).length > 0 ? nextState : null },
    )
  }, [incoming, location, navigate])

  useEffect(() => {
    if (!flash) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setFlash(null)
    }, FLASH_MESSAGE_CONFIG.DURATION_MS)

    return () => window.clearTimeout(timeoutId)
  }, [flash])

  if (!flash || flash.pathname !== location.pathname) {
    return null
  }

  const style = FLASH_STYLE[flash.type] ?? FLASH_STYLE[FLASH_MESSAGE_TYPE.INFO]
  const Icon = style.icon

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pt-6">
      <div
        className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', style.className)}
        role={style.role}
      >
        <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="flex-1 text-sm">
          {flash.title && <p className="font-semibold">{flash.title}</p>}
          {flash.message && (
            <p className={cn(flash.title && 'mt-0.5', 'text-foreground/80')}>{flash.message}</p>
          )}
        </div>
        <button
          aria-label="Đóng thông báo"
          className="rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={() => setFlash(null)}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  )
}

export default FlashMessage
