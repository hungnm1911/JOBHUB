import { useState } from 'react'
import { toast } from 'sonner'

import { closePublishedJobApi } from '@/apis/recruiter-job.api'
import { Button } from '@/components/ui/button'
import useCvCatalogOptions from '@/features/candidate-cvs/hooks/useCvCatalogOptions'
import { EMPLOYMENT_TYPE_LABEL, formatSalary } from '@/features/job-discovery/utils'
import { JOB_STATUS } from '@/utils/constant'

import useDistrictNames from '../hooks/useDistrictNames'
import { JOB_ROLE, formatDay, getEffectiveJobStatus, toRecruiterErrorMessage } from '../utils'
import ConfirmDialog from './ConfirmDialog'
import JobStatusBadge, { JobRoleChip } from './JobStatusBadge'
import RecruiterPageHeader from './RecruiterPageHeader'

function CloseJobButton({ jobId, onChanged }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setBusy(true)
    try {
      await closePublishedJobApi(jobId)
      toast.success('Đã đóng tuyển dụng.')
      onChanged()
    } catch (error) {
      toast.error(toRecruiterErrorMessage(error))
      if (error.status === 409) onChanged()
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <>
      <Button
        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
        type="button"
        variant="outline"
      >
        Đóng tuyển dụng
      </Button>
      <ConfirmDialog
        busy={busy}
        confirmLabel="Đóng tuyển dụng"
        description="Tin sẽ không còn hiển thị công khai và không nhận hồ sơ mới. Hồ sơ đã nhận vẫn xử lý được. Không thể mở lại tin."
        destructive
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
        open={open}
        title="Đóng tuyển dụng?"
      />
    </>
  )
}

function useJobSummary(job) {
  const { provinces } = useCvCatalogOptions()
  const provinceCode = job.location?.provinceCode
  const districts = useDistrictNames(provinceCode ? [provinceCode] : [])
  const location = [
    districts[provinceCode]?.[job.location?.districtCode],
    provinces.find((province) => province.code === provinceCode)?.name,
  ]
    .filter(Boolean)
    .join(', ')
  const deadline = formatDay(job.applicationDeadline)
  const published = formatDay(job.publishedAt)

  return [
    location,
    EMPLOYMENT_TYPE_LABEL[job.employmentType],
    job.salary ? formatSalary(job.salary) : null,
    deadline && `Hạn nộp ${deadline}`,
    published && `Đăng ngày ${published}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

function JobDetailHeader({ job, isPrimary, onChanged, children }) {
  const summary = useJobSummary(job)
  const status = getEffectiveJobStatus(job)
  const title = job.title || 'Chưa đặt tiêu đề'

  return (
    <RecruiterPageHeader
      actions={
        isPrimary &&
        status === JOB_STATUS.PUBLISHED && <CloseJobButton jobId={job.id} onChanged={onChanged} />
      }
      badges={
        <>
          <JobStatusBadge status={status} />
          <JobRoleChip role={isPrimary ? JOB_ROLE.PRIMARY : JOB_ROLE.NONE} />
        </>
      }
      breadcrumbs={[
        isPrimary
          ? { label: 'Job tôi phụ trách chính', to: '/recruiter/jobs' }
          : { label: 'Job được giao', to: '/recruiter/participating' },
        { label: title },
      ]}
      description={summary}
      title={title}
    >
      {children}
    </RecruiterPageHeader>
  )
}

export default JobDetailHeader
