import { CircleAlert, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { toOptimizationCommitErrorMessage } from '../utils'
import OptimizationDiffModal from './OptimizationDiffModal'

// AI-V06 F03/F04: Candidate reviews the whole signed Proposal and either
// cancels or saves it as a Draft. There is no per-change accept/reject.
// A retryable (unknown-outcome) Commit error stays visible here; the Quản lý CV
// link opens in a new tab so the Proposal is not lost while the Candidate checks.
function OptimizationProposalReviewModal({
  preview,
  committing,
  commitError,
  onCancel,
  onSave,
}) {
  return (
    <OptimizationDiffModal
      actions={
        <>
          <Button disabled={committing} onClick={onCancel} type="button" variant="outline">
            Hủy
          </Button>
          <Button disabled={committing} onClick={onSave} type="button">
            {committing ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            {committing ? 'Đang lưu…' : commitError ? 'Thử lưu lại' : 'Lưu bản nháp'}
          </Button>
        </>
      }
      baseline={preview.baseline}
      busy={committing}
      notice={
        commitError ? (
          <div
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
            data-testid="optimization-commit-error"
            role="alert"
          >
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p>{toOptimizationCommitErrorMessage(commitError)}</p>
              <a
                className="font-medium underline"
                href="/candidate/cvs"
                rel="noreferrer"
                target="_blank"
              >
                Mở Quản lý CV
              </a>
            </div>
          </div>
        ) : null
      }
      onClose={onCancel}
      proposedContent={preview.proposedContent}
    />
  )
}

export default OptimizationProposalReviewModal
