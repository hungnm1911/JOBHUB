import { useMemo } from 'react'

import { cn } from '@/lib/utils'
import { sanitizeRichText } from '@/lib/sanitize-rich-text'

function RichTextViewer({ value = '', format, preset = 'full', className }) {
  if (format !== 'html' && format !== 'plain') {
    throw new Error('RichTextViewer requires format="html" or format="plain"')
  }
  const html = useMemo(
    () => format === 'html' ? sanitizeRichText(value, preset) : '',
    [format, preset, value],
  )

  return format === 'html' ? (
    <div
      className={cn('rich-text-viewer text-sm text-foreground', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    <div className={cn('rich-text-viewer whitespace-pre-wrap text-sm text-foreground', className)}>
      {value ?? ''}
    </div>
  )
}

export default RichTextViewer
