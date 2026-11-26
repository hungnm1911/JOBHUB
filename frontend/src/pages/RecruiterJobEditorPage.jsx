import { Lock, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import {
  createDraftJobApi,
  deleteDraftJobApi,
  getRecruiterJobApi,
  submitDraftJobApi,
  updateDraftJobApi,
} from '@/apis/recruiter-job.api'
import { ErrorState, ListSkeleton, StateMessage } from '@/components/common/ListStates'
import useUnsavedChangesPrompt from '@/components/common/UnsavedChangesProvider/hooks/useUnsavedChangesPrompt'
import { Button } from '@/components/ui/button'
import { selectMembership } from '@/features/authentication/slice'
import ConfirmDialog from '@/features/recruiter-workspace/components/ConfirmDialog'
import RecruiterPageHeader from '@/features/recruiter-workspace/components/RecruiterPageHeader'
import RecruiterJobForm from '@/features/recruiter-workspace/components/RecruiterJobForm'
import useResource from '@/features/recruiter-workspace/hooks/useResource'
import { EMPTY_JOB_FORM, formToPayload, jobToForm } from '@/features/recruiter-workspace/job-form'
import { toRecruiterErrorMessage } from '@/features/recruiter-workspace/utils'
import { useAppSelector } from '@/store/hooks'
import { JOB_STATUS } from '@/utils/constant'

function JobEditor({ jobId, initialForm }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [baseline, setBaseline] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { markSaved } = useUnsavedChangesPrompt(JSON.stringify(form) !== JSON.stringify(baseline))

  const persist = async () => {
    const payload = formToPayload(form)
    const data = jobId ? await updateDraftJobApi(jobId, payload) : await createDraftJobApi(payload)
    setBaseline(form)
    markSaved()
    return data.job
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      const job = await persist()
      toast.success('Đã lưu bản nháp.')
      if (!jobId) navigate(`/recruiter/jobs/${job.id}/edit`, { replace: true })
    } catch (error) {
      toast.error(toRecruiterErrorMessage(error, 'Không lưu được bản nháp. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    let savedJob = null
    try {
      savedJob = await persist()
      await submitDraftJobApi(savedJob.id)
      toast.success('Đã gửi tin cho Quản lý công ty duyệt.')
      navigate(`/recruiter/jobs/${savedJob.id}`, { replace: true })
    } catch (error) {
      toast.error(
        toRecruiterErrorMessage(error, 'Chưa gửi duyệt được. Vui lòng kiểm tra lại nội dung.'),
      )
      // The draft was saved even when submit failed; keep editing the persisted Job.
      if (savedJob && !jobId) navigate(`/recruiter/jobs/${savedJob.id}/edit`, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteDraftJobApi(jobId)
      markSaved()
      toast.success('Đã xóa bản nháp.')
      navigate('/recruiter/jobs', { replace: true })
    } catch (error) {
      toast.error(toRecruiterErrorMessage(error))
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <RecruiterJobForm
        form={form}
        onChange={setForm}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
        saving={saving}
        status={JOB_STATUS.DRAFT}
        submitting={submitting}
      />
      {jobId && (
        <Button
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setConfirmDelete(true)}
          type="button"
          variant="outline"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Xóa bản nháp
        </Button>
      )}
      <ConfirmDialog
        busy={deleting}
        confirmLabel="Xóa tin"
        description="Tin sẽ bị xóa vĩnh viễn và không thể khôi phục."
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        open={confirmDelete}
        title="Xóa bản nháp này?"
      />
    </div>
  )
}

function EditExistingJob({ jobId }) {
  const membership = useAppSelector(selectMembership)
  const { data, loading, error, reload } = useResource(getRecruiterJobApi, jobId)

  if (loading) return <ListSkeleton label="Đang tải Job" />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const job = data.job
  const isPrimary = job.primaryRecruiterCompanyMemberId === membership?.id
  if (job.status !== JOB_STATUS.DRAFT || !isPrimary) {
    return (
      <StateMessage
        action={
          <Button asChild variant="outline">
            <Link to={`/recruiter/jobs/${job.id}`}>Xem chi tiết Job</Link>
          </Button>
        }
        description={
          isPrimary
            ? 'Chỉ sửa được tin khi còn là bản nháp.'
            : 'Chỉ người phụ trách chính mới sửa được bản nháp này.'
        }
        icon={Lock}
        title="Tin này không thể chỉnh sửa"
      />
    )
  }

  // Keyed by Job so a reload never mixes two Jobs' form state.
  return <JobEditor initialForm={jobToForm(job)} jobId={job.id} key={job.id} />
}

function RecruiterJobEditorPage() {
  const { jobId } = useParams()
  const isEdit = Boolean(jobId)

  return (
    <div className="space-y-6">
      <RecruiterPageHeader
        breadcrumbs={[
          { label: 'Job tôi phụ trách chính', to: '/recruiter/jobs' },
          ...(isEdit ? [{ label: 'Chi tiết Job', to: `/recruiter/jobs/${jobId}` }] : []),
          { label: isEdit ? 'Sửa bản nháp' : 'Tạo job mới' },
        ]}
        description="Bạn có thể lưu nháp bất cứ lúc nào và hoàn thiện sau."
        title={isEdit ? 'Sửa bản nháp' : 'Tạo job mới'}
      />

      {isEdit ? (
        <EditExistingJob jobId={jobId} />
      ) : (
        <JobEditor initialForm={{ ...EMPTY_JOB_FORM }} jobId={null} />
      )}
    </div>
  )
}

export default RecruiterJobEditorPage
