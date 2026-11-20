import { ArrowLeft, ChevronRight, MoreHorizontal, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import CompanyLogo from '@/features/job-discovery/components/CompanyLogo'

import { APPLICATION_STATUS_LABEL, CONVERSATION_MODE, CONVERSATION_MODE_LABEL } from '../utils'

function ChatHeader({ application, mode, onBack = null }) {
  const recruiter = application?.assignedRecruiter
  const company = application?.company
  const jobTitle = application?.job?.title
  const jobId = application?.jobId || application?.job?.id
  const statusLabel = APPLICATION_STATUS_LABEL[application?.status] ?? application?.status
  const modeLabel = mode ? CONVERSATION_MODE_LABEL[mode] : null
  const showModeBadge = mode && mode !== CONVERSATION_MODE.ACTIVE
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) {
      return undefined
    }
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpen])

  return (
    <header className="shrink-0 border-b bg-card px-3 py-2 sm:px-4">
      <div className="flex items-center gap-2.5">
        {onBack ? (
          <Button
            aria-label="Quay lại danh sách"
            className="size-8 shrink-0 lg:hidden"
            onClick={onBack}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </Button>
        ) : null}

        {recruiter?.avatarUrl ? (
          <img
            alt=""
            className="size-9 shrink-0 rounded-full object-cover"
            src={recruiter.avatarUrl}
          />
        ) : company ? (
          <CompanyLogo className="size-9 shrink-0 rounded-full" company={company} />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <UserRound aria-hidden="true" className="size-4" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <h2 className="truncate text-sm font-semibold tracking-tight">
              {recruiter?.fullName || company?.name || 'Nhà tuyển dụng'}
            </h2>
            {statusLabel ? (
              <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                {statusLabel}
              </span>
            ) : null}
            {showModeBadge ? (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {modeLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[recruiter?.jobTitle, company?.name, jobTitle].filter(Boolean).join(' · ') ||
              'Hội thoại ứng tuyển'}
          </p>
        </div>

        <div className="relative shrink-0" ref={menuRef}>
          <Button
            aria-expanded={menuOpen}
            aria-haspopup="true"
            aria-label="Thêm thao tác"
            className="size-8"
            onClick={() => setMenuOpen((current) => !current)}
            size="icon"
            type="button"
            variant="outline"
          >
            <MoreHorizontal aria-hidden="true" className="size-4" />
          </Button>
          {menuOpen ? (
            <div className="absolute top-full right-0 z-50 mt-1.5 w-52 overflow-hidden rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-border/40">
              {application?.id ? (
                <Link
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors hover:bg-secondary/80 sm:text-sm"
                  onClick={() => setMenuOpen(false)}
                  to={`/candidate/applications/${encodeURIComponent(application.id)}`}
                >
                  Chi tiết đơn
                  <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
                </Link>
              ) : null}
              {jobId ? (
                <Link
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors hover:bg-secondary/80 sm:text-sm"
                  onClick={() => setMenuOpen(false)}
                  to={`/jobs/${encodeURIComponent(jobId)}`}
                >
                  Xem việc làm
                  <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export default ChatHeader
