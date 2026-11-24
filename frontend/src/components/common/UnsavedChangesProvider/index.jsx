import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

import { UnsavedChangesContext } from './hooks/useUnsavedChangesPrompt'

function UnsavedChangesProvider({ children }) {
  const dirtyFormsRef = useRef(new Set())
  const bypassRef = useRef(false)
  const [pendingAction, setPendingAction] = useState(null)
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    !bypassRef.current && dirtyFormsRef.current.size > 0 &&
    (currentLocation.pathname !== nextLocation.pathname ||
      currentLocation.search !== nextLocation.search ||
      currentLocation.hash !== nextLocation.hash),
  )

  const setDirty = useCallback((id, dirty) => {
    if (dirty) dirtyFormsRef.current.add(id)
    else dirtyFormsRef.current.delete(id)
  }, [])

  const requestDiscard = useCallback((action) => {
    setPendingAction(() => action)
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (dirtyFormsRef.current.size === 0) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const cancel = () => {
    setPendingAction(null)
    if (blocker.state === 'blocked') blocker.reset()
  }

  const proceed = () => {
    if (blocker.state === 'blocked') {
      blocker.proceed()
      return
    }
    const action = pendingAction
    setPendingAction(null)
    if (!action) return
    bypassRef.current = true
    try {
      action()
    } finally {
      queueMicrotask(() => { bypassRef.current = false })
    }
  }

  const context = useMemo(() => ({ setDirty, requestDiscard }), [setDirty, requestDiscard])

  return (
    <UnsavedChangesContext.Provider value={context}>
      {children}
      <AlertDialog open={blocker.state === 'blocked' || Boolean(pendingAction)} onOpenChange={(open) => { if (!open) cancel() }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rời đi khi chưa lưu thay đổi?</AlertDialogTitle>
            <AlertDialogDescription>
              Các thay đổi chưa được lưu sẽ bị mất nếu bạn rời khỏi đây.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button asChild variant="outline"><AlertDialogCancel onClick={cancel}>Ở lại</AlertDialogCancel></Button>
            <Button asChild className="bg-destructive text-destructive-foreground hover:bg-destructive/90"><AlertDialogAction onClick={proceed}>Rời đi</AlertDialogAction></Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedChangesContext.Provider>
  )
}

export default UnsavedChangesProvider
