import { createContext, useCallback, useContext, useEffect, useId, useRef } from 'react'

const UnsavedChangesContext = createContext(null)

function useUnsavedChangesPrompt(isDirty) {
  const context = useContext(UnsavedChangesContext)
  const id = useId()
  const savedRef = useRef(false)

  useEffect(() => {
    if (!context) return undefined
    if (!isDirty) savedRef.current = false
    context.setDirty(id, isDirty && !savedRef.current)
    return () => context.setDirty(id, false)
  }, [context, id, isDirty])

  const markSaved = useCallback(() => {
    savedRef.current = true
    context?.setDirty(id, false)
  }, [context, id])

  const confirmDiscard = useCallback((action) => {
    if (!isDirty || savedRef.current || !context) action()
    else context.requestDiscard(action)
  }, [context, isDirty])

  return { confirmDiscard, markSaved }
}

export { UnsavedChangesContext }
export default useUnsavedChangesPrompt
