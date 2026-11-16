import { Clock3, MapPin, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import CompanyLogo from '@/features/job-discovery/components/CompanyLogo'
import { formatProvince } from '@/features/job-discovery/utils'
import { JOB_INVITATION_STATUS } from '@/utils/constant'
import { cn } from '@/lib/utils'

import {
  canAcceptInvitation,
  canRejectInvitation,
  formatDate,
  formatDateTime,
  formatExpiryCountdown,
  formatInvitationJobMeta,
} from '../utils'
import InvitationStatusBadge from './InvitationStatusBadge'

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
  const jobMeta = formatInvitationJobMeta(job)
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
      ? `Đã chấp nhận ${formatDateTime(invitation.acceptedAt) ?? formatDate(invitation.acceptedAt)}`
      : invitation.status === JOB_INVITATION_STATUS.REJECTED && invitation.rejectedAt
        ? `Đã từ chối ${formatDateTime(invitation.rejectedAt) ?? formatDate(invitation.rejectedAt)}`
        : invitation.status === JOB_INVITATION_STATUS.REVOKED && invitation.revokedAt
          ? `Đã thu hồi ${formatDateTime(invitation.revokedAt) ?? formatDate(invitation.revokedAt)}`
          : invitation.status === JOB_INVITATION_STATUS.INVALIDATED
            ? invitation.invalidationReason || 'Lời mời không còn hiệu lực'
            : null

  return (
    <article className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <CompanyLogo className="size-12" company={company} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                {jobId ? (
                  <Link
                    className="hover:underline"
                    to={`/jobs/${encodeURIComponent(jobId)}`}
                  >
                    {job?.title ?? 'Việc làm'}
                  </Link>
                ) : (
                  (job?.title ?? 'Việc làm')
                )}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {company?.name ?? 'Công ty'}
                {sentLabel ? ` · Gửi ${sentLabel}` : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <InvitationStatusBadge status={invitation.status} />
              {expiryCountdown ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                    expiryCountdown.startsWith('Còn')
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Clock3 aria-hidden="true" className="size-3.5" />
                  {expiryCountdown}
                </span>
              ) : null}
            </div>
          </div>

          {(jobMeta.length > 0 || locationLabel) && (
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {jobMeta.map((item) => (
                <li key={item}>{item}</li>
              ))}
              {locationLabel ? (
                <li className="inline-flex items-center gap-1">
                  <MapPin aria-hidden="true" className="size-3.5" />
                  {locationLabel}
                </li>
              ) : null}
            </ul>
          )}

          {expiryDateLabel && invitation.status === JOB_INVITATION_STATUS.PENDING ? (
            <p className="text-xs text-muted-foreground">Hạn phản hồi: {expiryDateLabel}</p>
          ) : null}

          {terminalNote ? (
            <p className="text-xs text-muted-foreground">{terminalNote}</p>
          ) : null}
        </div>
      </div>

      {(sender || greetingMessage) && (
        <div className="mt-4 rounded-lg border bg-secondary/40 px-3 py-3 sm:px-4">
          {sender ? (
            <div className="flex items-center gap-3">
              {sender.avatarUrl ? (
                <img
                  alt=""
                  className="size-10 rounded-full object-cover"
                  src={sender.avatarUrl}
                />
              ) : (
                <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <UserRound aria-hidden="true" className="size-5" />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {sender.fullName || 'Nhà tuyển dụng'}
                </p>
                {sender.jobTitle ? (
                  <p className="text-xs text-muted-foreground">{sender.jobTitle}</p>
                ) : null}
              </div>
            </div>
          ) : null}
          {greetingMessage ? (
            <p
              className={cn(
                'whitespace-pre-wrap text-sm text-foreground',
                sender ? 'mt-3 border-t pt-3' : null,
              )}
            >
              {greetingMessage}
            </p>
          ) : null}
        </div>
      )}

      {skills.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li
              className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
              key={skill}
            >
              {skill}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
        {jobId ? (
          <Button asChild size="sm" variant="outline">
            <Link to={`/jobs/${encodeURIComponent(jobId)}`}>Xem chi tiết JD</Link>
          </Button>
        ) : null}
        {showReject ? (
          <Button onClick={() => onReject(invitation)} size="sm" type="button" variant="outline">
            Từ chối
          </Button>
        ) : null}
        {showAccept ? (
          <Button onClick={() => onAccept(invitation)} size="sm" type="button">
            Chấp nhận
          </Button>
        ) : null}
        {invitation.status === JOB_INVITATION_STATUS.ACCEPTED ? (
          <Button asChild size="sm">
            <Link to="/candidate/applications">Xem đơn ứng tuyển</Link>
          </Button>
        ) : null}
      </div>
    </article>
  )
}

export default InvitationCard
