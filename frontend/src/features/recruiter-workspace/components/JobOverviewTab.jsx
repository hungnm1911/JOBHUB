import { Info, Pencil, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { deleteDraftJobApi, submitDraftJobApi } from '@/apis/recruiter-job.api'
import RichTextViewer from '@/components/common/RichTextViewer'
import { Button } from '@/components/ui/button'
import useCvCatalogOptions from '@/features/candidate-cvs/hooks/useCvCatalogOptions'
import {
  EMPLOYMENT_TYPE_LABEL,
  EXPERIENCE_LEVEL_LABEL,
  formatSalary,
  formatWorkModes,
} from '@/features/job-discovery/utils'
import { JOB_STATUS } from '@/utils/constant'

import useDistrictNames from '../hooks/useDistrictNames'
import usePositionsByField from '../hooks/usePositionsByField'
import { formatDay, getEffectiveJobStatus, toRecruiterErrorMessage } from '../utils'
import ConfirmDialog from './ConfirmDialog'
import Panel from './Panel'

const ACTION = Object.freeze({ SUBMIT: 'submit', DELETE: 'delete' })

const CONFIRM_COPY = Object.freeze({
  [ACTION.SUBMIT]: {
    title: 'Gửi tin cho Quản lý công ty duyệt?',
    description: 'Nội dung tin sẽ bị khóa cho đến khi Quản lý công ty duyệt hoặc từ chối.',
    confirmLabel: 'Gửi duyệt',
    success: 'Đã gửi tin đi duyệt.',
  },
  [ACTION.DELETE]: {
    title: 'Xóa bản nháp này?',
    description: 'Tin sẽ bị xóa vĩnh viễn và không thể khôi phục.',
    confirmLabel: 'Xóa tin',
    destructive: true,
    success: 'Đã xóa bản nháp.',
  },
})

const STATUS_NOTICE = Object.freeze({
  [JOB_STATUS.PENDING_APPROVAL]: 'Tin đang chờ Quản lý công ty duyệt. Nội dung đã bị khóa.',
  [JOB_STATUS.CLOSED]: 'Tin đã đóng tuyển dụng.',
  [JOB_STATUS.EXPIRED]: 'Tin đã hết hạn nhận hồ sơ.',
})

function useCatalogNames(job) {
  const catalogs = useCvCatalogOptions()
  const fieldIds = useMemo(() => job.fieldCategoryIds ?? [], [job])
  const { positionsByField } = usePositionsByField(fieldIds)
  const districts = useDistrictNames(job.location?.provinceCode ? [job.location.provinceCode] : [])
  const fieldNames = new Map(catalogs.fields.map((field) => [field.id, field.name]))
  const positionNames = new Map(
    Object.values(positionsByField).flat().map((position) => [position.id, position.name]),
  )
  const level = catalogs.experienceLevels.find((item) => item.id === job.experienceLevelId)

  return {
    fields: fieldIds.map((id) => fieldNames.get(id)).filter(Boolean).join(', '),
    positions: (job.positionCategoryIds ?? []).map((id) => positionNames.get(id)).filter(Boolean).join(', '),
    location: [
      districts[job.location?.provinceCode]?.[job.location?.districtCode],
      catalogs.provinces.find((province) => province.code === job.location?.provinceCode)?.name,
    ]
      .filter(Boolean)
      .join(', '),
    experience: level ? (EXPERIENCE_LEVEL_LABEL[level.code] ?? level.name) : null,
  }
}

function JobOverviewTab({ job, isPrimary, onChanged }) {
  const navigate = useNavigate()
  const names = useCatalogNames(job)
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const status = getEffectiveJobStatus(job)
  const copy = pending ? CONFIRM_COPY[pending] : null

  const confirm = async () => {
    setBusy(true)
    try {
      if (pending === ACTION.DELETE) {
        await deleteDraftJobApi(job.id)
        toast.success(copy.success)
        navigate('/recruiter/jobs', { replace: true })
        return
      }
      await submitDraftJobApi(job.id)
      toast.success(copy.success)
      onChanged()
    } catch (error) {
      toast.error(toRecruiterErrorMessage(error))
      if (error.status === 409) onChanged()
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  const facts = [
    { label: 'Lĩnh vực', value: names.fields },
    { label: 'Vị trí chuyên môn', value: names.positions },
    { label: 'Cấp bậc kinh nghiệm', value: names.experience },
    { label: 'Loại hình', value: EMPLOYMENT_TYPE_LABEL[job.employmentType] },
    { label: 'Hình thức làm việc', value: formatWorkModes(job.workModes) },
    { label: 'Địa điểm', value: names.location },
    { label: 'Mức lương', value: job.salary ? formatSalary(job.salary) : null },
    { label: 'Hạn nhận hồ sơ', value: formatDay(job.applicationDeadline) },
    { label: 'Ngày tạo', value: formatDay(job.createdAt) },
    { label: 'Ngày đăng', value: formatDay(job.publishedAt) },
  ]

  return (
    <div className="space-y-4">
      {STATUS_NOTICE[status] && (
        <p className="flex items-start gap-2 rounded-lg border bg-secondary/60 px-4 py-3 text-sm">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {STATUS_NOTICE[status]}
        </p>
      )}

      {isPrimary && status === JOB_STATUS.DRAFT && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setPending(ACTION.SUBMIT)} type="button">
            <Send aria-hidden="true" className="size-4" />
            Gửi duyệt
          </Button>
          <Button asChild variant="outline">
            <Link to={`/recruiter/jobs/${job.id}/edit`}>
              <Pencil aria-hidden="true" className="size-4" />
              Sửa
            </Link>
          </Button>
          <Button
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setPending(ACTION.DELETE)}
            type="button"
            variant="outline"
          >
            Xóa
          </Button>
        </div>
      )}
      <Panel className="space-y-5">
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {facts.map(({ label, value }) => (
            <div className="min-w-0" key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 text-sm font-medium break-words">{value || 'Chưa có'}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t pt-4">
          <h2 className="text-sm font-semibold">Kỹ năng yêu cầu</h2>
          {job.requiredSkills?.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {job.requiredSkills.map((skill) => (
                <li
                  className="rounded-full border bg-secondary px-3 py-1 text-sm"
                  key={skill}
                >
                  {skill}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Chưa có kỹ năng.</p>
          )}
        </div>
        <div className="border-t pt-4">
          <h2 className="mb-3 text-base font-semibold">Mô tả công việc</h2>
          <div className="max-w-3xl">
            <RichTextViewer
              format={job.jobDescriptionHtml ? 'html' : 'plain'}
              value={job.jobDescriptionHtml || job.jobDescription || 'Chưa có mô tả.'}
            />
          </div>
        </div>
      </Panel>

      <ConfirmDialog
        busy={busy}
        confirmLabel={copy?.confirmLabel}
        description={copy?.description}
        destructive={copy?.destructive}
        onCancel={() => setPending(null)}
        onConfirm={confirm}
        open={Boolean(copy)}
        title={copy?.title}
      />
    </div>
  )
}

export default JobOverviewTab
