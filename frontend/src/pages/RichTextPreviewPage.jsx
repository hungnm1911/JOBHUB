import { useState } from 'react'

import RichTextEditor from '@/components/common/RichTextEditor'
import RichTextViewer from '@/components/common/RichTextViewer'
import { Button } from '@/components/ui/button'

const UNSAFE_HTML = '<h2 style="text-align: center">Tiêu đề hợp lệ</h2><p onclick="alert(1)" style="text-align: right; position: fixed">Nội dung <strong>đậm</strong> <mark>tô sáng</mark> <a href="javascript:alert(1)">URL nguy hiểm</a></p><script>alert(1)</script>'
const LEGACY_TEXT = 'Văn bản cũ có <strong>thẻ HTML</strong> được hiển thị nguyên văn.\nDòng thứ hai.'

function RichTextPreviewPage() {
  const [preset, setPreset] = useState('full')
  const [html, setHtml] = useState('')
  const [editorHtml, setEditorHtml] = useState('')
  const [loadedHtml, setLoadedHtml] = useState(null)
  const [viewerSource, setViewerSource] = useState('editor')
  const [externalValue, setExternalValue] = useState('')

  function choosePreset(nextPreset) {
    setPreset(nextPreset)
    clearEditor()
  }

  const viewerFormat = viewerSource === 'plain' ? 'plain' : 'html'
  const viewerValue = viewerSource === 'editor' ? editorHtml : externalValue

  function clearEditor() {
    setHtml('')
    setEditorHtml('')
    setLoadedHtml(null)
    setViewerSource('editor')
  }

  function loadExternalHtml() {
    setLoadedHtml(externalValue)
    setHtml(externalValue)
    setViewerSource('editor')
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Rich Text V04 · Preview</h1>
        <p className="text-muted-foreground">Thử Editor → HTML → Viewer ngay trong trình duyệt. Nội dung preview chỉ nằm trên trang này và không gửi tới Backend.</p>
      </header>

      <section className="space-y-3" aria-labelledby="preview-preset-heading">
        <h2 className="text-lg font-semibold" id="preview-preset-heading">Preset</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Chọn preset Rich Text">
          <Button aria-pressed={preset === 'full'} onClick={() => choosePreset('full')} type="button" variant={preset === 'full' ? 'default' : 'outline'}>Full · Job</Button>
          <Button aria-pressed={preset === 'minimal'} onClick={() => choosePreset('minimal')} type="button" variant={preset === 'minimal' ? 'default' : 'outline'}>Minimal · CV</Button>
        </div>
        <p className="text-sm text-muted-foreground">Đổi preset sẽ xóa nội dung Editor để kiểm tra từng bộ định dạng riêng.</p>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="min-w-0 space-y-3" aria-labelledby="preview-editor-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold" id="preview-editor-heading">Editor</h2>
            <Button onClick={clearEditor} size="sm" type="button" variant="outline">Xóa nội dung</Button>
          </div>
          <p className="text-sm text-muted-foreground">Chọn văn bản rồi dùng toolbar. Thử danh sách, liên kết và hoàn tác; Full có thêm tiêu đề, căn lề, phông, cỡ, màu và tô sáng.</p>
          <RichTextEditor key={preset} onChange={(nextHtml) => { setHtml(nextHtml); setEditorHtml(nextHtml) }} onValueSync={setEditorHtml} placeholder="Nhập nội dung để xem HTML và bản hiển thị…" preset={preset} value={html} />
          <div className="space-y-2">
            {loadedHtml !== null && (
              <>
                <h3 className="font-medium">HTML đầu vào đã nạp</h3>
                <pre className="min-h-20 overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-border bg-secondary/60 p-3 text-sm" data-testid="rich-text-loaded-html">{loadedHtml || '(chuỗi rỗng)'}</pre>
              </>
            )}
            <h3 className="font-medium">HTML từ Editor</h3>
            <pre className="min-h-20 overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-border bg-secondary/60 p-3 text-sm" data-testid="rich-text-html-output">{editorHtml || '(chuỗi rỗng)'}</pre>
            <p className="text-sm text-muted-foreground">HTML từ Editor được cập nhật ngay sau khi nạp hoặc chỉnh sửa nội dung.</p>
          </div>
        </section>

        <section className="min-w-0 space-y-3" aria-labelledby="preview-viewer-heading">
          <h2 className="text-lg font-semibold" id="preview-viewer-heading">Viewer</h2>
          <label className="block space-y-1 text-sm" htmlFor="rich-text-viewer-source">
            <span>Nguồn hiển thị</span>
            <select
              className="block h-10 w-full rounded-md border border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring"
              id="rich-text-viewer-source"
              onChange={(event) => setViewerSource(event.target.value)}
              value={viewerSource}
            >
              <option value="editor">HTML từ Editor</option>
              <option value="html">HTML nhập vào</option>
              <option value="plain">Plain text cũ</option>
            </select>
          </label>
          {viewerSource !== 'editor' && (
            <div className="space-y-2">
              <label className="block text-sm" htmlFor="rich-text-external-value">{viewerSource === 'plain' ? 'Plain text đầu vào' : 'HTML đầu vào'}</label>
              <textarea
                className="min-h-32 w-full rounded-md border border-input bg-background p-3 font-mono text-sm focus-visible:outline-2 focus-visible:outline-ring"
                id="rich-text-external-value"
                onChange={(event) => setExternalValue(event.target.value)}
                value={externalValue}
              />
              {viewerSource === 'html' && <Button onClick={loadExternalHtml} size="sm" type="button" variant="outline">Nạp HTML vào Editor</Button>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setExternalValue(UNSAFE_HTML); setViewerSource('html') }} size="sm" type="button" variant="outline">Thử HTML nguy hiểm</Button>
            <Button onClick={() => { setExternalValue(LEGACY_TEXT); setViewerSource('plain') }} size="sm" type="button" variant="outline">Thử plain text cũ</Button>
          </div>
          <div className="min-h-32 rounded-md border border-border bg-background p-3" data-testid="rich-text-preview-viewer">
            {viewerValue ? <RichTextViewer format={viewerFormat} preset={preset} value={viewerValue} /> : <p className="text-sm text-muted-foreground">Chưa có nội dung.</p>}
          </div>
          <p className="text-sm text-muted-foreground">HTML được lọc theo preset trước khi Viewer hiển thị. Plain text hiển thị nguyên văn, kể cả ký tự giống thẻ HTML.</p>
        </section>
      </div>
    </div>
  )
}

export default RichTextPreviewPage
