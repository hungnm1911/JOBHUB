import { useCallback, useEffect, useRef, useState } from 'react'

const DESKTOP_QUERY = '(min-width: 64rem)'

// The full-screen mobile menu behaves as a modal: it takes focus, closes on Escape,
// locks page scrolling and returns focus to its trigger.
function useMobileMenu() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const closeRef = useRef(null)
  const show = useCallback(() => setOpen(true), [])
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return undefined

    const trigger = triggerRef.current
    const previousOverflow = document.body.style.overflow
    const desktop = window.matchMedia(DESKTOP_QUERY)
    const closeOnDesktop = () => desktop.matches && close()
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') close()
    }

    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    document.addEventListener('keydown', closeOnEscape)
    desktop.addEventListener('change', closeOnDesktop)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
      desktop.removeEventListener('change', closeOnDesktop)
      // The trigger stays inert until the next frame.
      requestAnimationFrame(() => trigger?.focus())
    }
  }, [open, close])

  return { open, show, close, triggerRef, closeRef }
}

export default useMobileMenu
