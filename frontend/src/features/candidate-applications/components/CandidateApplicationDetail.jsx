import {
  ArrowLeft,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  MapPin,
  MessageSquare,
  RotateCw,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { downloadOwnApplicationSubmittedCvApi } from '@/apis/application.api'
import CenteredState from '@/components/common/CenteredState'
import PageHeader from '@/components/common/PageHeader'
import RichTextViewer from '@/components/common/RichTextViewer'
import { Button } from '@/components/ui/button'
import { selectAuthenticatedUser } from '@/features/authentication/slice'
import ApplicationStatusBadge from '@/features/candidate-dashboard/components/ApplicationStatusBadge'
import CompanyLogo from '@/features/job-discovery/components/CompanyLogo'
import useDiscoveryCatalogs from '@/features/job-discovery/hooks/useDiscoveryCatalogs'
import { formatProvince } from '@/features/job-discovery/utils'
import { useAppSelector } from '@/store/hooks'

import useCandidateApplicationDetail from '../hooks/useCandidateApplicationDetail'
import {
  APPLICATION_SOURCE_LABEL,
  CV_SOURCE_LABEL,
  canReplaceSubmittedCv,
  canWithdrawApplication,
  fileNameFromContentDisposition,
  formatBytes,
  formatDate,
  formatDateTime,
  formatJobMeta,
  mergeApplicationDetailUpdate,
  triggerBlobDownload,
} from '../utils'
import ApplicationAvailabilitySection from './ApplicationAvailabilitySection'
import ApplicationConversationPanel from './ApplicationConversationPanel'
import ApplicationInterviewSection from './ApplicationInterviewSection'
import ReplaceSubmittedCvModal from './ReplaceSubmittedCvModal'
import SubmittedCvPreviewModal from './SubmittedCvPreviewModal'
import WithdrawApplicationModal from './WithdrawApplicationModal'

function CandidateApplicationDetail({ applicationId }) {
  const { loading, application, error, reload, setApplication } =
    useCandidateApplicationDetail(applicationId)
  const { provinceNameByCode } = useDiscoveryCatalogs()
  const currentUser = useAppSelector(selectAuthenticatedUser)
  const [dialog, setDialog] = useState(null)
  const [conversationOpen, setConversationOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const handleDownloadCv = async () => {
    if (!application) {
      return
    }
    setDownloading(true)
    try {
      const response = await downloadOwnApplicationSubmittedCvApi(application.id)
      const fallback =
        application.submittedCvSnapshot?.pdfFile?.originalFileName ||
        `${application.submittedCvSnapshot?.name || 'cv'}.pdf`
      const fileName = fileNameFromContentDisposition(
        response.headers?.['content-disposition'],
        fallback,
      )
      triggerBlobDownload(response.data, fileName)
      toast.success('Đã tải CV đã nộp')
    } catch (downloadError) {
      toast.error(downloadError.message || 'Không tải được CV đã nộp.')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <CenteredState
        icon={LoaderCircle}
        spinning
        title="Đang tải đơn ứng tuyển…"
        tone="bg-primary/10 text-primary"
      />
    )
  }

  if (error || !application) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost">
          <Link to="/candidate/applications">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Quay lại danh sách đơn
          </Link>
        </Button>
        <CenteredState
          action={
            <Button onClick={reload} variant="outline">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          }
          description={error?.message || 'Không tìm thấy đơn ứng tuyển.'}
          icon={FileText}
          title="Không tải được đơn"
          tone="bg-secondary text-muted-foreground"
        />
      </div>
    )
  }

  const job = application.job
  const company = application.company
  const snapshot = application.submittedCvSnapshot
  const recruiter = application.assignedRecruiter
  const locationLabel = job?.location
    ? [job.location.addressText, formatProvince(job.location, provinceNameByCode)]
        .filter(Boolean)
        .join(', ')
    : null
  const jobMeta = formatJobMeta(job)
  const appliedLabel = formatDate(application.appliedAt)
  const withdrawnLabel = formatDateTime(application.withdrawnAt)

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button asChild className="-ml-2" variant="ghost">
          <Link to="/candidate/applications">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Quay lại danh sách đơn
          </Link>
        </Button>

        <PageHeader
          actions={
            <div className="flex flex-wrap gap-2">
              {canWithdrawApplication(application) ? (
                <Button
                  onClick={() => setDialog({ type: 'withdraw' })}
                  type="button"
                  variant="outline"
                >
                  Rút đơn ứng tuyển
                </Button>
              ) : null}
              <Button asChild type="button">
                <Link
                  to={`/candidate/messages?applicationId=${encodeURIComponent(application.id)}`}
                >
                  <MessageSquare aria-hidden="true" className="size-4" />
                  Tin nhắn
                </Link>
              </Button>
              <Button
                onClick={() => setConversationOpen((current) => !current)}
                type="button"
                variant="outline"
              >
                {conversationOpen ? 'Thu gọn chat' : 'Chat nhanh'}
              </Button>
            </div>
          }
          description={
            appliedLabel
              ? `Nộp ngày ${appliedLabel}${company?.name ? ` · ${company.name}` : ''}`
              : company?.name
          }
          eyebrow="Đơn ứng tuyển"
          title={job?.title ?? 'Chi tiết đơn ứng tuyển'}
        />
      </div>

      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-4">
          <CompanyLogo className="size-14" company={company} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{company?.name ?? 'Công ty'}</p>
                <h2 className="text-xl font-semibold tracking-tight">
                  {job?.title ?? 'Việc làm'}
                </h2>
              </div>
              <ApplicationStatusBadge className="text-sm" status={application.status} />
            </div>

            {jobMeta.length > 0 || locationLabel ? (
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
            ) : null}

            {job?.id ? (
              <Button asChild className="px-0" variant="link">
                <Link to={`/jobs/${encodeURIComponent(job.id)}`}>Xem trang việc làm</Link>
              </Button>
            ) : null}
          </div>
        </div>

        {(recruiter || withdrawnLabel) && (
          <div className="mt-4 flex flex-wrap gap-4 border-t pt-4">
            {recruiter ? (
              <div className="flex items-center gap-3">
                {recruiter.avatarUrl ? (
                  <img
                    alt=""
                    className="size-10 rounded-full object-cover"
                    src={recruiter.avatarUrl}
                  />
                ) : (
                  <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <UserRound aria-hidden="true" className="size-5" />
                  </span>
                )}
                <div>
                  <p className="text-sm font-medium">
                    {recruiter.fullName || 'Nhà tuyển dụng phụ trách'}
                  </p>
                  {recruiter.jobTitle ? (
                    <p className="text-xs text-muted-foreground">{recruiter.jobTitle}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {withdrawnLabel ? (
              <div className="text-sm text-muted-foreground">
                <p>Đã rút lúc {withdrawnLabel}</p>
                {application.withdrawReason ? (
                  <p className="mt-1 max-w-prose">{application.withdrawReason}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <ApplicationInterviewSection
            application={application}
            onScheduleUpdated={(interviewSchedule) => {
              setApplication({
                ...application,
                interviewSchedules: (application.interviewSchedules ?? []).map((item) =>
                  item.id === interviewSchedule.id ? interviewSchedule : item,
                ),
              })
            }}
          />

          <section className="rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="submitted-cv-heading">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold" id="submitted-cv-heading">
                  Hồ sơ đã nộp
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Snapshot CV tại thời điểm ứng tuyển (hoặc lần thay gần nhất).
                </p>
              </div>
              {canReplaceSubmittedCv(application) ? (
                <Button
                  onClick={() => setDialog({ type: 'replace-cv' })}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Thay CV đã nộp
                </Button>
              ) : null}
            </div>

            {snapshot ? (
              <div className="mt-4 rounded-lg border px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{snapshot.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {CV_SOURCE_LABEL[snapshot.sourceType] ?? snapshot.sourceType}
                      {snapshot.pdfFile?.originalFileName
                        ? ` · ${snapshot.pdfFile.originalFileName}`
                        : null}
                      {formatBytes(snapshot.pdfFile?.sizeBytes)
                        ? ` · ${formatBytes(snapshot.pdfFile.sizeBytes)}`
                        : null}
                      {snapshot.pdfFile?.pageCount
                        ? ` · ${snapshot.pdfFile.pageCount} trang`
                        : null}
                    </p>
                    {formatDateTime(snapshot.capturedAt) ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Chụp lúc {formatDateTime(snapshot.capturedAt)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setDialog({ type: 'preview-cv' })}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Eye aria-hidden="true" className="size-4" />
                      Xem
                    </Button>
                    <Button
                      disabled={downloading}
                      onClick={handleDownloadCv}
                      size="sm"
                      type="button"
                    >
                      {downloading ? (
                        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                      ) : (
                        <Download aria-hidden="true" className="size-4" />
                      )}
                      Tải xuống
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Không có snapshot CV cho đơn này.</p>
            )}
          </section>

          {job ? (
            <section className="rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="job-info-heading">
              <h2 className="text-base font-semibold" id="job-info-heading">
                Thông tin việc làm
              </h2>

              <div className="mt-4 space-y-5">
                <div>
                  <h3 className="text-sm font-medium">Mô tả</h3>
                  <RichTextViewer
                    className="mt-2 max-w-[70ch] text-sm leading-6 text-foreground/90"
                    format={job.jobDescriptionHtml ? 'html' : 'plain'}
                    preset="full"
                    value={job.jobDescriptionHtml || job.jobDescription || 'Chưa có mô tả.'}
                  />
                </div>

                {job.requiredSkills?.length > 0 ? (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-medium">Kỹ năng yêu cầu</h3>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {job.requiredSkills.map((skill) => (
                        <li
                          className="rounded-md bg-secondary px-2.5 py-1 text-sm"
                          key={skill}
                        >
                          {skill}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <ApplicationConversationPanel
            applicationId={application.id}
            currentUserId={currentUser?.id ?? null}
            onClose={() => setConversationOpen(false)}
            open={conversationOpen}
          />
        </div>

        <aside className="space-y-6">
          <ApplicationAvailabilitySection
            application={application}
            onAvailabilityUpdated={(availability) => {
              setApplication({ ...application, availability })
            }}
          />

          <section className="rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="text-sm font-semibold">Trạng thái đơn</h2>
            <div className="mt-3">
              <ApplicationStatusBadge status={application.status} />
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Ngày nộp</dt>
                <dd>{appliedLabel ?? '—'}</dd>
              </div>
              {application.source ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Nguồn</dt>
                  <dd className="text-right">
                    {APPLICATION_SOURCE_LABEL[application.source] ?? application.source}
                  </dd>
                </div>
              ) : null}
              {application.isUnassigned ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Phụ trách</dt>
                  <dd>Chưa gán recruiter</dd>
                </div>
              ) : null}
            </dl>
          </section>
        </aside>
      </div>

      {dialog?.type === 'withdraw' ? (
        <WithdrawApplicationModal
          application={application}
          onClose={() => setDialog(null)}
          onWithdrawn={(next) =>
            setApplication((current) => mergeApplicationDetailUpdate(current, next))
          }
        />
      ) : null}

      {dialog?.type === 'replace-cv' ? (
        <ReplaceSubmittedCvModal
          application={application}
          onClose={() => setDialog(null)}
          onReplaced={(next) =>
            setApplication((current) => mergeApplicationDetailUpdate(current, next))
          }
        />
      ) : null}

      {dialog?.type === 'preview-cv' && snapshot ? (
        <SubmittedCvPreviewModal
          applicationId={application.id}
          onClose={() => setDialog(null)}
          onDownload={handleDownloadCv}
          title={snapshot.name}
        />
      ) : null}
    </div>
  )
}

export default CandidateApplicationDetail
