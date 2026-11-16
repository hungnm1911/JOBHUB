import { LoaderCircle, Send } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function MessageComposer({
  value,
  onChange,
  onSend,
  disabled = false,
  sending = false,
  autoFocus = false,
  focusKey = null,
  placeholder = 'Nhập tin nhắn… Enter để gửi, Shift+Enter để xuống dòng',
  readOnlyHint = null,
}) {
  const textareaRef = useRef(null)

  useEffect(() => {
    const node = textareaRef.current
    if (!node) {
      return
    }
    node.style.height = '0px'
    node.style.height = `${Math.min(node.scrollHeight, 112)}px`
  }, [value])

  useEffect(() => {
    if (!autoFocus || disabled || sending || readOnlyHint) {
      return
    }
    const node = textareaRef.current
    if (!node) {
      return
    }
    const frame = requestAnimationFrame(() => {
      node.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [autoFocus, disabled, sending, readOnlyHint, focusKey])

  if (readOnlyHint) {
    return (
      <div className="shrink-0 border-t bg-card px-3 py-2.5 sm:px-4">
        <p className="rounded-lg bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
          {readOnlyHint}
        </p>
      </div>
    )
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!disabled && !sending && value.trim()) {
      onSend()
    }
  }

  const handleKeyDown = (event) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (!disabled && !sending && value.trim()) {
        onSend()
      }
    }
  }

  return (
    <form
      className="shrink-0 border-t bg-card px-3 py-2 sm:px-4"
      onSubmit={handleSubmit}
    >
      <div className="flex items-end gap-2 rounded-xl border bg-background p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-ring">
        <label className="sr-only" htmlFor="candidate-chat-composer">
          Nội dung tin nhắn
        </label>
        <textarea
          className={cn(
            'max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-[13px] leading-5 outline-none',
            'placeholder:text-muted-foreground',
          )}
          disabled={disabled || sending}
          id="candidate-chat-composer"
          maxLength={10000}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          ref={textareaRef}
          rows={1}
          value={value}
        />
        <Button
          aria-label="Gửi tin nhắn"
          className="size-8 shrink-0 rounded-lg"
          disabled={disabled || sending || !value.trim()}
          size="icon"
          type="submit"
        >
          {sending ? (
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
          ) : (
            <Send aria-hidden="true" className="size-3.5" />
          )}
        </Button>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 px-1 text-[10px] text-muted-foreground">
        <span>Enter gửi · Shift+Enter xuống dòng</span>
        <span>{value.length}/10000</span>
      </div>
    </form>
  )
}

export default MessageComposer
