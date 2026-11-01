import { EditorContent, useEditor } from '@tiptap/react'
import { generateJSON } from '@tiptap/core'
import { Placeholder } from '@tiptap/extensions'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useMemo, useRef } from 'react'

import RichTextToolbar from '@/components/common/RichTextToolbar'
import { safeRichTextHref } from '@/lib/sanitize-rich-text'
import { cn } from '@/lib/utils'

const SHARED_STARTER_KIT = {
  blockquote: false,
  code: false,
  codeBlock: false,
  horizontalRule: false,
  strike: false,
  trailingNode: false,
  link: { isAllowedUri: safeRichTextHref, shouldAutoLink: safeRichTextHref },
}
const MINIMAL_STARTER_KIT = StarterKit.configure({ ...SHARED_STARTER_KIT, heading: false })
const FULL_STARTER_KIT = StarterKit.configure({ ...SHARED_STARTER_KIT, heading: { levels: [1, 2, 3] } })
const FULL_FORMATTING = [
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TextStyle,
  FontFamily,
  FontSize,
  Color,
  Highlight,
]
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
  onValueSync,
  disabled = false,
  placeholder = '',
  preset = 'full',
  className,
}) {
  const onChangeRef = useRef(onChange)
  const onValueSyncRef = useRef(onValueSync)
  const pendingEmptyEchoRef = useRef(false)
  const extensions = useMemo(
    () => [
      preset === 'minimal' ? MINIMAL_STARTER_KIT : FULL_STARTER_KIT,
      ...(preset === 'minimal' ? [] : FULL_FORMATTING),
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
    onValueSyncRef.current = onValueSync
  }, [onValueSync])

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
    if (editor.getHTML() !== nextValue) {
      const nextDocument = editor.schema.nodeFromJSON(generateJSON(nextValue, extensions))
      if (!editor.state.doc.eq(nextDocument)) {
        editor.commands.setContent(nextValue, { emitUpdate: false })
      }
    }
    onValueSyncRef.current?.(editor.isEmpty ? '' : normalizeEmptyHTML(editor.getHTML()))
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
      <RichTextToolbar editor={editor} preset={preset} disabled={disabled} />
      <EditorContent editor={editor} />
    </div>
  )
}

export default RichTextEditor
