import { EditorContent, useEditor } from '@tiptap/react'
import { generateJSON } from '@tiptap/core'
import { Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useMemo, useRef } from 'react'

import { cn } from '@/lib/utils'

const MINIMAL_STARTER_KIT = StarterKit.configure({
  blockquote: false,
  bulletList: false,
  codeBlock: false,
  heading: false,
  horizontalRule: false,
  listItem: false,
  orderedList: false,
})
const FULL_STARTER_KIT = StarterKit.configure({ trailingNode: false })
const EMPTY_HTML = new Set(['', '<p></p>', '<p><br></p>'])

function normalizeEmptyHTML(html) {
  return EMPTY_HTML.has(html) ? '' : html
}

function readPlaceholder({ editor }) {
  return editor.options.editorProps?.attributes?.['data-placeholder'] ?? ''
}

function RichTextEditor({
  value = '',
  onChange,
  disabled = false,
  placeholder = '',
  preset = 'full',
  className,
}) {
  const onChangeRef = useRef(onChange)
  const pendingEmptyEchoRef = useRef(false)
  const extensions = useMemo(
    () => [
      preset === 'minimal' ? MINIMAL_STARTER_KIT : FULL_STARTER_KIT,
      Placeholder.configure({ placeholder: readPlaceholder, showOnlyWhenEditable: false }),
    ],
    [preset],
  )
  const editor = useEditor(
    {
      extensions,
      content: normalizeEmptyHTML(value ?? ''),
      editable: !disabled,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          'aria-label': 'Trình soạn thảo văn bản',
          'aria-multiline': 'true',
          'data-placeholder': placeholder,
          role: 'textbox',
        },
      },
      onUpdate: ({ editor: updatedEditor }) => {
        const html = updatedEditor.isEmpty ? '' : normalizeEmptyHTML(updatedEditor.getHTML())
        pendingEmptyEchoRef.current = html === '' && Boolean(onChangeRef.current)
        onChangeRef.current?.(html)
      },
    },
    [preset],
  )

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: { ...editor.options.editorProps.attributes, 'data-placeholder': placeholder },
      },
    })
  }, [editor, placeholder])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    const nextValue = normalizeEmptyHTML(value ?? '')
    if (pendingEmptyEchoRef.current && value === '') {
      pendingEmptyEchoRef.current = false
      return
    }
    pendingEmptyEchoRef.current = false
    if (editor.getHTML() === nextValue) return

    const nextDocument = editor.schema.nodeFromJSON(generateJSON(nextValue, extensions))
    if (editor.state.doc.eq(nextDocument)) return

    editor.commands.setContent(nextValue, { emitUpdate: false })
  }, [editor, extensions, value])

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(!disabled, false)
  }, [disabled, editor])

  return (
    <div
      aria-disabled={disabled || undefined}
      className={cn(
        'rich-text-editor min-h-32 rounded-md border border-input bg-secondary/60 px-3 py-2.5 text-sm shadow-xs transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <EditorContent editor={editor} />
    </div>
  )
}

export default RichTextEditor
