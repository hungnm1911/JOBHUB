import { FileText, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'

import { previewSearchCandidateCvApi } from '@/apis/recruiter-sourcing.api'
import { ErrorState } from '@/components/common/ListStates'
import { Button } from '@/components/ui/button'
import BackLink from '@/features/recruiter-workspace/components/BackLink'
import { SkillChips } from '@/features/recruiter-workspace/components/CandidateCvCard'
import InviteDialog from '@/features/recruiter-workspace/components/InviteDialog'
import PdfPreview from '@/features/recruiter-workspace/components/PdfPreview'
import RecruiterPageHeader from '@/features/recruiter-workspace/components/RecruiterPageHeader'

// The search result travels in router state: there is no endpoint for one CV's metadata.
function MetadataPanel({ cv, canInvite, onInvite }) {
  return (
    <aside aria-label="Thông tin CV" className="space-y-4 rounded-lg border bg-card p-4">
      {cv ? (
        <>
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
              <FileText aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold break-words">{cv.cvName}</h2>
              <p className="text-sm break-words text-muted-foreground">{cv.candidateName ?? 'Ứng viên'}</p>
            </div>
          </div>
          <dl className="space-y-3 border-t pt-4">
            {cv.facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                <dd className="text-sm break-words">{fact.value}</dd>
              </div>
            ))}
          </dl>
          {cv.skills.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <h3 className="text-xs text-muted-foreground">Kỹ năng</h3>
              <SkillChips skills={cv.skills} />
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Thông tin tóm tắt của CV chỉ hiển thị khi mở từ trang tìm kiếm.
        </p>
      )}
      <Button className="w-full" disabled={!canInvite} onClick={onInvite} type="button">
        <Send aria-hidden="true" className="size-4" />
        Mời ứng tuyển
      </Button>
    </aside>
  )
}

// V14: preview only; there is no download of a searched CV.
function CandidateCv({ cvId, cv, backTo }) {
  const [view, setView] = useState({ url: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    let active = true
    let url = null
    previewSearchCandidateCvApi(cvId).then(
      (response) => {
        if (!active) return
        url = URL.createObjectURL(response.data)
        setView({ url, error: null })
      },
      (error) => active && setView({ url: null, error }),
    )
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [cvId, attempt])

  if (view.error) {
    return (
      <div className="space-y-4">
        <BackLink to={backTo}>Quay lại kết quả tìm kiếm</BackLink>
        <ErrorState error={view.error} onRetry={() => setAttempt((value) => value + 1)} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <RecruiterPageHeader
        breadcrumbs={[{ label: 'Tìm kiếm ứng viên', to: backTo }, { label: cv?.cvName ?? 'Xem CV' }]}
        title={cv?.cvName ?? 'Xem CV'}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="order-2 min-w-0 lg:order-1">
          <PdfPreview className="h-[calc(100svh-14rem)] min-h-128" title="CV ứng viên" url={view.url} viewOnly />
        </div>
        <div className="order-1 lg:order-2">
          <MetadataPanel canInvite={Boolean(view.url)} cv={cv} onInvite={() => setInviting(true)} />
        </div>
      </div>
      {inviting && <InviteDialog cv={cv ?? { cvId }} onClose={() => setInviting(false)} />}
    </div>
  )
}

function RecruiterCandidateCvPage() {
  const { cvId } = useParams()
  const { state } = useLocation()
  const cv = state?.cv?.cvId === cvId ? state.cv : null

  return <CandidateCv backTo={`/recruiter/candidates${state?.from ?? ''}`} cv={cv} cvId={cvId} key={cvId} />
}

export default RecruiterCandidateCvPage
