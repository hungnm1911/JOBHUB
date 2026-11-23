import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import ProfileModal from '@/features/candidate-profile/components/ProfileModal'

import { buildOptimizationDiffSections, CHANGE } from '../diffSections'

const CHANGE_LABEL = Object.freeze({
  [CHANGE.UNCHANGED]: 'Không thay đổi',
  [CHANGE.EMPTY]: 'Không có nội dung',
  [CHANGE.ADDED]: 'Được thêm',
  [CHANGE.REMOVED]: 'Bị xóa',
  [CHANGE.MODIFIED]: 'Đã chỉnh sửa',
})

// react-diff-viewer-continued@4.4.0 pins `diffContainer { min-width: 1000px }`
// (only released below 768px) and `pre { width: fit-content }`, which make the
// table wider than the modal body and push the right column out of view.
// Release both so every column shares the available width and long lines wrap.
const DIFF_STYLES = Object.freeze({
  diffContainer: { minWidth: 0, width: '100%', tableLayout: 'fixed', pre: { width: 'auto' } },
})

const NARROW_QUERY = '(max-width: 639px)'
const isNarrowViewport = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(NARROW_QUERY).matches

// Review-only Preview Diff (AI-V06 F04): no editing and no per-change
// accept/reject. The caller decides whole-Proposal actions through `actions`
// and surfaces results through `notice`; `busy` locks closing while saving.
function OptimizationDiffModal({
  baseline,
  proposedContent,
  onClose,
  actions,
  notice,
  busy = false,
}) {
  const [splitView, setSplitView] = useState(() => !isNarrowViewport())
  const sections = useMemo(
    () => buildOptimizationDiffSections(baseline, proposedContent),
    [baseline, proposedContent],
  )
  const hasChanges = sections.some(
    ({ change }) =>
      change === CHANGE.ADDED || change === CHANGE.REMOVED || change === CHANGE.MODIFIED,
  )

  return (
    <ProfileModal
      description="Đối chiếu nội dung gốc với bản tối ưu trước khi lưu. Bạn chỉ xem xét, không chỉnh sửa tại đây."
      busy={busy}
      footer={
        actions ?? (
          <Button onClick={onClose} type="button" variant="outline">
            Đóng
          </Button>
        )
      }
      onClose={onClose}
      panelClassName="max-h-[calc(100dvh-2rem)] max-w-5xl"
      title="So sánh bản tối ưu"
    >
      <div className="space-y-4" data-testid="optimization-diff">
        {notice}
        {!hasChanges && (
          <p
            className="rounded-md border bg-muted/40 px-3 py-2 text-sm"
            data-testid="optimization-no-changes"
          >
            Bản tối ưu không thay đổi nội dung so với bản gốc. Bạn vẫn có thể lưu bản nháp này.
          </p>
        )}
        <div className="flex gap-2" role="group" aria-label="Chế độ xem">
          <Button
            aria-pressed={splitView}
            onClick={() => setSplitView(true)}
            size="sm"
            type="button"
            variant={splitView ? 'default' : 'outline'}
          >
            Song song
          </Button>
          <Button
            aria-pressed={!splitView}
            onClick={() => setSplitView(false)}
            size="sm"
            type="button"
            variant={!splitView ? 'default' : 'outline'}
          >
            Gộp
          </Button>
        </div>
        {!splitView && (
          <p className="text-xs text-muted-foreground" data-testid="unified-legend">
            Chế độ gộp: dòng bị xóa (−) là bản gốc, dòng được thêm (+) là bản tối ưu.
          </p>
        )}

        {sections.map((section) => (
          <section
            aria-labelledby={`diff-${section.key}`}
            data-change={section.change}
            data-section={section.key}
            key={section.key}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold" id={`diff-${section.key}`}>
                {section.title}
              </h3>
              <span className="text-xs text-muted-foreground">
                {CHANGE_LABEL[section.change]}
              </span>
            </div>
            {section.change === CHANGE.EMPTY && (
              <p className="text-sm text-muted-foreground">Không có nội dung.</p>
            )}
            {section.change === CHANGE.UNCHANGED && (
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 text-sm">
                {section.after}
              </pre>
            )}
            {(section.change === CHANGE.ADDED ||
              section.change === CHANGE.REMOVED ||
              section.change === CHANGE.MODIFIED) && (
              <div className="min-w-0 overflow-x-auto rounded-md border text-sm">
                <ReactDiffViewer
                  compareMethod={DiffMethod.WORDS}
                  extraLinesSurroundingDiff={3}
                  leftTitle={splitView ? 'Trước' : undefined}
                  newValue={section.after}
                  oldValue={section.before}
                  rightTitle={splitView ? 'Sau' : undefined}
                  showDiffOnly
                  styles={DIFF_STYLES}
                  splitView={splitView}
                />
              </div>
            )}
          </section>
        ))}
      </div>
    </ProfileModal>
  )
}

export default OptimizationDiffModal
