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

// Review-only Preview Diff (AI-V06 F04): no editing and no per-change
// accept/reject. Saving is decided outside this component.
function OptimizationDiffModal({ baseline, proposedContent, onClose }) {
  const [splitView, setSplitView] = useState(true)
  const sections = useMemo(
    () => buildOptimizationDiffSections(baseline, proposedContent),
    [baseline, proposedContent],
  )

  return (
    <ProfileModal
      description="Đối chiếu nội dung gốc với bản tối ưu trước khi lưu. Bạn chỉ xem xét, không chỉnh sửa tại đây."
      footer={
        <Button onClick={onClose} type="button" variant="outline">
          Đóng
        </Button>
      }
      onClose={onClose}
      panelClassName="max-w-5xl"
      title="So sánh bản tối ưu"
    >
      <div className="space-y-4" data-testid="optimization-diff">
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
              <div className="max-h-96 overflow-auto rounded-md border text-sm">
                <ReactDiffViewer
                  compareMethod={DiffMethod.WORDS}
                  extraLinesSurroundingDiff={3}
                  leftTitle="Trước"
                  newValue={section.after}
                  oldValue={section.before}
                  rightTitle="Sau"
                  showDiffOnly
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
