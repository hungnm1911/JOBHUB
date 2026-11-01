import { useEditorState } from '@tiptap/react'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Heading1, Heading2,
  Heading3, Highlighter, Italic, Link2, List, ListOrdered, Redo2, Underline, Undo2,
} from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'

const SHARED_ACTIONS = [
  { label: 'Đậm', icon: Bold, mark: 'bold', command: 'toggleBold' },
  { label: 'Nghiêng', icon: Italic, mark: 'italic', command: 'toggleItalic' },
  { label: 'Gạch chân', icon: Underline, mark: 'underline', command: 'toggleUnderline' },
  { label: 'Danh sách dấu đầu dòng', icon: List, mark: 'bulletList', command: 'toggleBulletList' },
  { label: 'Danh sách đánh số', icon: ListOrdered, mark: 'orderedList', command: 'toggleOrderedList' },
]
const HEADINGS = [
  { label: 'Tiêu đề 1', icon: Heading1, level: 1 },
  { label: 'Tiêu đề 2', icon: Heading2, level: 2 },
  { label: 'Tiêu đề 3', icon: Heading3, level: 3 },
]
const ALIGNMENTS = [
  { label: 'Căn trái', icon: AlignLeft, value: 'left' },
  { label: 'Căn giữa', icon: AlignCenter, value: 'center' },
  { label: 'Căn phải', icon: AlignRight, value: 'right' },
  { label: 'Căn đều', icon: AlignJustify, value: 'justify' },
]

function colorInputValue(color) {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(color ?? '')
  if (!rgb) return '#000000'
  const channels = rgb.slice(1).map(Number)
  if (channels.some((channel) => channel > 255)) return '#000000'
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function ToolbarButton({ label, icon: Icon, active, disabled, onClick }) {
  return (
    <Button
      aria-label={label}
      aria-pressed={active}
      className="size-9 p-0"
      disabled={disabled}
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      size="icon"
      title={label}
      type="button"
      variant={active ? 'outline' : 'ghost'}
    >
      <Icon aria-hidden="true" className="size-4" />
    </Button>
  )
}

function RichTextToolbar({ editor, preset = 'full', disabled = false }) {
  const controlId = useId()
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkHref, setLinkHref] = useState('')
  const [linkError, setLinkError] = useState('')
  useEditorState({ editor, selector: ({ editor: current }) => current?.state, equalityFn: Object.is })

  const unavailable = disabled || !editor || editor.isDestroyed || !editor.isEditable
  const full = preset !== 'minimal'

  function startLink() {
    setLinkHref(editor.getAttributes('link').href ?? '')
    setLinkError('')
    setLinkOpen(true)
  }

  function saveLink(event) {
    event.preventDefault()
    const href = linkHref.trim()
    if (!href || !editor.chain().focus().extendMarkRange('link').setLink({ href }).run()) {
      setLinkError('Không thể lưu liên kết. Vui lòng kiểm tra URL.')
      return
    }
    setLinkError('')
    setLinkOpen(false)
  }

  return (
    <div className="mb-2 border-b border-border pb-2" role="toolbar" aria-label="Định dạng văn bản">
      <div className="flex flex-wrap items-center gap-1">
        {full && HEADINGS.map(({ label, icon, level }) => (
          <ToolbarButton
            key={label}
            label={label}
            icon={icon}
            active={editor?.isActive('heading', { level }) || false}
            disabled={unavailable || !editor.can().chain().focus().toggleHeading({ level }).run()}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          />
        ))}
        {SHARED_ACTIONS.map(({ label, icon, mark, command }) => (
          <ToolbarButton
            key={label}
            label={label}
            icon={icon}
            active={editor?.isActive(mark) || false}
            disabled={unavailable || !editor.can().chain().focus()[command]().run()}
            onClick={() => editor.chain().focus()[command]().run()}
          />
        ))}
        <ToolbarButton
          label="Chèn hoặc sửa liên kết"
          icon={Link2}
          active={editor?.isActive('link') || false}
          disabled={unavailable || (editor.state.selection.empty && !editor.isActive('link'))}
          onClick={startLink}
        />
        {editor?.isActive('link') && (
          <Button
            aria-label="Gỡ liên kết"
            disabled={unavailable}
            onClick={() => editor.chain().focus().unsetLink().run()}
            onMouseDown={(event) => event.preventDefault()}
            size="sm"
            type="button"
            variant="ghost"
          >
            Gỡ liên kết
          </Button>
        )}
        {full && ALIGNMENTS.map(({ label, icon, value }) => (
          <ToolbarButton
            key={label}
            label={label}
            icon={icon}
            active={editor?.isActive({ textAlign: value }) || false}
            disabled={unavailable || !editor.can().chain().focus().setTextAlign(value).run()}
            onClick={() => editor.chain().focus().setTextAlign(value).run()}
          />
        ))}
        {full && (
          <>
            <label className="sr-only" htmlFor={`${controlId}-font-family`}>Phông chữ</label>
            <select
              id={`${controlId}-font-family`}
              aria-label="Phông chữ"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
              disabled={unavailable}
              onChange={(event) => {
                const value = event.target.value
                const chain = editor.chain().focus()
                if (value) chain.setFontFamily(value).run()
                else chain.unsetFontFamily().run()
              }}
              value={editor?.getAttributes('textStyle').fontFamily ?? ''}
            >
              <option value="">Phông mặc định</option>
              <option value="Arial">Arial</option>
              <option value="Georgia">Georgia</option>
              <option value="Times New Roman">Times New Roman</option>
            </select>
            <label className="sr-only" htmlFor={`${controlId}-font-size`}>Cỡ chữ</label>
            <select
              id={`${controlId}-font-size`}
              aria-label="Cỡ chữ"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
              disabled={unavailable}
              onChange={(event) => {
                const value = event.target.value
                const chain = editor.chain().focus()
                if (value) chain.setFontSize(value).run()
                else chain.unsetFontSize().run()
              }}
              value={editor?.getAttributes('textStyle').fontSize ?? ''}
            >
              <option value="">Cỡ mặc định</option>
              <option value="12px">12</option>
              <option value="14px">14</option>
              <option value="16px">16</option>
              <option value="18px">18</option>
              <option value="24px">24</option>
            </select>
            <label className="flex h-9 items-center gap-1 rounded-md border border-input bg-background px-2 text-sm">
              Màu chữ
              <input
                aria-label="Màu chữ"
                className="size-6 cursor-pointer"
                disabled={unavailable}
                onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
                type="color"
                value={colorInputValue(editor?.getAttributes('textStyle').color)}
              />
            </label>
            {editor?.getAttributes('textStyle').color && (
              <Button
                aria-label="Đặt lại màu chữ"
                disabled={unavailable}
                onClick={() => editor.chain().focus().unsetColor().run()}
                onMouseDown={(event) => event.preventDefault()}
                size="sm"
                type="button"
                variant="ghost"
              >
                Màu mặc định
              </Button>
            )}
            <ToolbarButton
              label="Tô sáng"
              icon={Highlighter}
              active={editor?.isActive('highlight') || false}
              disabled={unavailable || !editor.can().chain().focus().toggleHighlight().run()}
              onClick={() => editor.chain().focus().toggleHighlight().run()}
            />
          </>
        )}
        <ToolbarButton
          label="Hoàn tác"
          icon={Undo2}
          disabled={unavailable || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          label="Làm lại"
          icon={Redo2}
          disabled={unavailable || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>
      {linkOpen && !unavailable && (
        <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={saveLink}>
          <label className="text-sm" htmlFor={`${controlId}-link-url`}>Đường dẫn</label>
          <input
            autoFocus
            aria-invalid={Boolean(linkError) || undefined}
            className="h-9 min-w-48 flex-1 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            id={`${controlId}-link-url`}
            onChange={(event) => {
              setLinkHref(event.target.value)
              setLinkError('')
            }}
            required
            type="url"
            value={linkHref}
          />
          {linkError && <span className="text-sm text-destructive" role="alert">{linkError}</span>}
          <Button size="sm" type="submit">Lưu</Button>
          <Button onClick={() => setLinkOpen(false)} size="sm" type="button" variant="ghost">Hủy</Button>
        </form>
      )}
    </div>
  )
}

export default RichTextToolbar
