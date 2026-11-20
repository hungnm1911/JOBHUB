import {
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  MessageSquareQuote,
  UserRound,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import CompanyLogo from '@/features/job-discovery/components/CompanyLogo'
import {
  EMPLOYMENT_TYPE_LABEL,
  formatProvince,
  formatSalary,
  formatWorkModes,
} from '@/features/job-discovery/utils'
import { cn } from '@/lib/utils'
import { JOB_INVITATION_STATUS } from '@/utils/constant'

import {
  canAcceptInvitation,
  canRejectInvitation,
  formatDate,
  formatDateTime,
  formatExpiryCountdown,
} from '../utils'
import InvitationStatusBadge from './InvitationStatusBadge'

const CARD_STYLE_BY_STATUS = Object.freeze({
  [JOB_INVITATION_STATUS.PENDING]:
    'border-amber-500/35 border-l-amber-500 bg-amber-500/[0.02] ring-1 ring-amber-500/15',
  [JOB_INVITATION_STATUS.ACCEPTED]:
    'border-emerald-500/25 border-l-emerald-500 bg-emerald-500/[0.015]',
  [JOB_INVITATION_STATUS.REJECTED]:
    'border-rose-500/25 border-l-rose-500 bg-rose-500/[0.01]',
  [JOB_INVITATION_STATUS.EXPIRED]:
    'border-dashed border-slate-300 border-l-solid border-l-slate-400 bg-muted/20',
  [JOB_INVITATION_STATUS.REVOKED]:
    'border-dashed border-slate-300 border-l-solid border-l-slate-400 bg-muted/20',
  [JOB_INVITATION_STATUS.INVALIDATED]:
    'border-dashed border-slate-300 border-l-solid border-l-slate-400 bg-muted/20',
})

function InvitationCard({
  invitation,
  provinceNameByCode,
  onAccept,
  onReject,
}) {
  const job = invitation.job
  const company = invitation.company
  const sender = invitation.sender
  const jobId = invitation.jobId || job?.id
  const salaryLabel = job ? formatSalary(job.salary) : null
  const employmentLabel = job
    ? (EMPLOYMENT_TYPE_LABEL[job.employmentType] ?? job.employmentType)
    : null
  const workModeLabel = job ? formatWorkModes(job.workModes) : null
  const locationLabel = job?.location
    ? [job.location.addressText, formatProvince(job.location, provinceNameByCode)]
        .filter(Boolean)
        .join(', ')
    : null
  const skills = Array.isArray(job?.requiredSkills) ? job.requiredSkills.filter(Boolean) : []
  const greetingMessage = invitation.greetingMessage?.trim()
  const sentLabel = formatDateTime(invitation.sentAt) ?? formatDate(invitation.sentAt)
  const expiryCountdown =
    invitation.status === JOB_INVITATION_STATUS.PENDING
      ? formatExpiryCountdown(invitation.expiresAt)
      : null
  const expiryDateLabel = formatDateTime(invitation.expiresAt) ?? formatDate(invitation.expiresAt)
  const showAccept = canAcceptInvitation(invitation)
  const showReject = canRejectInvitation(invitation)
  const terminalNote =
    invitation.status === JOB_INVITATION_STATUS.ACCEPTED && invitation.acceptedAt
      ? `Đã chấp nhận lúc ${formatDateTime(invitation.acceptedAt) ?? formatDate(invitation.acceptedAt)}`
      : invitation.status === JOB_INVITATION_STATUS.REJECTED && invitation.rejectedAt
        ? `Đã từ chối lúc ${formatDateTime(invitation.rejectedAt) ?? formatDate(invitation.rejectedAt)}`
        : invitation.status === JOB_INVITATION_STATUS.REVOKED && invitation.revokedAt
          ? `Nhà tuyển dụng đã thu hồi lúc ${formatDateTime(invitation.revokedAt) ?? formatDate(invitation.revokedAt)}`
          : invitation.status === JOB_INVITATION_STATUS.INVALIDATED
            ? invitation.invalidationReason || 'Lời mời không còn hiệu lực'
            : null

  return (
    <article
      className={cn(
        'group relative rounded-xl border border-l-4 bg-card p-4 transition-shadow hover:shadow-md sm:p-5',
        CARD_STYLE_BY_STATUS[invitation.status] ?? 'border-border border-l-primary',
      )}
    >
      <div className="flex flex-wrap items-start gap-4">
        <CompanyLogo className="size-12 shrink-0 rounded-xl" company={company} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {company?.id ? (
                  <Link
                    className="text-xs font-semibold tracking-wide text-primary uppercase hover:underline"
                    to={`/companies/${encodeURIComponent(company.id)}`}
                  >
                    {company.name}
                  </Link>
                ) : (
                  <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {company?.name ?? 'Công ty'}
                  </span>
                )}
                {sentLabel ? (
                  <span className="text-xs text-muted-foreground">· Gửi {sentLabel}</span>
                ) : null}
              </div>

              <h2 className="mt-1 text-base font-semibold tracking-tight sm:text-lg">
                {jobId ? (
                  <Link
                    className="hover:text-primary hover:underline"
                    to={`/jobs/${encodeURIComponent(jobId)}`}
                  >
                    {job?.title ?? 'Việc làm'}
                  </Link>
                ) : (
                  (job?.title ?? 'Việc làm')
                )}
              </h2>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <InvitationStatusBadge status={invitation.status} />
              {expiryCountdown ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                    expiryCountdown.startsWith('Còn')
                      ? 'border-destructive/30 bg-destructive/10 text-destructive'
                      : 'border-border bg-muted text-muted-foreground',
                  )}
                >
                  <Clock3 aria-hidden="true" className="size-3.5" />
                  {expiryCountdown}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {salaryLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-0.5 text-[11px] font-semibold text-success-foreground">
                <Banknote aria-hidden="true" className="size-3" />
                {salaryLabel}
              </span>
            ) : null}

            {employmentLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                <BriefcaseBusiness aria-hidden="true" className="size-3" />
                {employmentLabel}
              </span>
            ) : null}

            {workModeLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                <Clock3 aria-hidden="true" className="size-3" />
                {workModeLabel}
              </span>
            ) : null}
          </div>

          {(locationLabel || (expiryDateLabel && invitation.status === JOB_INVITATION_STATUS.PENDING) || terminalNote) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {locationLabel ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                  {locationLabel}
                </span>
              ) : null}

              {expiryDateLabel && invitation.status === JOB_INVITATION_STATUS.PENDING ? (
                <span className="inline-flex items-center gap-1 font-medium text-amber-800">
                  <CalendarClock aria-hidden="true" className="size-3.5 shrink-0" />
                  Hạn phản hồi: {expiryDateLabel}
                </span>
              ) : null}

              {terminalNote ? <span>{terminalNote}</span> : null}
            </div>
          )}
        </div>
      </div>

      {(sender || greetingMessage) && (
        <div className="mt-4 rounded-xl border bg-background/80 p-3.5 sm:px-4">
          <div className="flex items-center justify-between gap-2">
            {sender ? (
              <div className="flex min-w-0 items-center gap-2.5">
                {sender.avatarUrl ? (
                  <img
                    alt=""
                    className="size-8 shrink-0 rounded-full object-cover"
                    src={sender.avatarUrl}
                  />
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound aria-hidden="true" className="size-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {sender.fullName || 'Nhà tuyển dụng'}
                    {sender.jobTitle ? (
                      <span className="font-normal text-muted-foreground"> · {sender.jobTitle}</span>
                    ) : null}
                  </p>
                </div>
              </div>
            ) : null}
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <MessageSquareQuote aria-hidden="true" className="size-3.5" />
              Lời nhắn tuyển dụng
            </span>
          </div>
          {greetingMessage ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
              “{greetingMessage}”
            </p>
          ) : null}
        </div>
      )}

      {skills.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <li
              className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
              key={skill}
            >
              {skill}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-1">
        <div>
          {jobId ? (
            <Button
              asChild
              className="border-primary/35 bg-primary/10 font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
              size="sm"
              variant="outline"
            >
              <Link to={`/jobs/${encodeURIComponent(jobId)}`}>
                Xem chi tiết JD
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showReject ? (
            <Button onClick={() => onReject(invitation)} size="sm" type="button" variant="outline">
              <XCircle aria-hidden="true" className="size-3.5" />
              Từ chối
            </Button>
          ) : null}
          {showAccept ? (
            <Button onClick={() => onAccept(invitation)} size="sm" type="button">
              <CheckCircle2 aria-hidden="true" className="size-3.5" />
              Chấp nhận lời mời
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default InvitationCard
