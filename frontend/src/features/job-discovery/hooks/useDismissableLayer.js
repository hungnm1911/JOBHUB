import { useEffect } from 'react'

function useDismissableLayer(containerRef, open, onDismiss) {
  useEffect(() => {
    if (!open) {
      return undefined
    }

    const dismissOnOutsidePointer = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        onDismiss()
      }
    }
    const dismissOnEscape = (event) => {
      if (event.key === 'Escape') {
        onDismiss()
      }
    }

    document.addEventListener('pointerdown', dismissOnOutsidePointer)
    document.addEventListener('keydown', dismissOnEscape)

    return () => {
      document.removeEventListener('pointerdown', dismissOnOutsidePointer)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [containerRef, open, onDismiss])
}

export default useDismissableLayer
