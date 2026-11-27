import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import {
  approveCompanyJobApi,
  closePublishedJobApi,
  getRecruiterJobApi,
  rejectCompanyJobApi,
} from '@/apis/recruiter-job.api'
import { ErrorState, ListSkeleton } from '@/components/common/ListStates'
import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import {
  ConfirmDialog,
  getEffectiveJobStatus,
  JobOverviewTab,
  JobStatusBadge,
  JobTeamTab,
  useResource,
} from '@/features/recruiter-workspace/public'
import { cn } from '@/lib/utils'
import { FLASH_MESSAGE_TYPE, JOB_STATUS } from '@/utils/constant'

import { companyErrorMessage } from '../utils'
import CompanyJobApplications from './CompanyJobApplications'

const actions = {
  approve: {
    title: 'Duyệt và đăng Job?',
    description:
      'Job sẽ được công khai ngay sau khi duyệt. Nội dung đã đăng không được chỉnh sửa.',
    label: 'Duyệt và đăng Job',
    api: approveCompanyJobApi,
    success: 'Đã duyệt và đăng Job công khai.',
  },
  reject: {
    title: 'Từ chối và xóa Job?',
    description:
      'Job chờ duyệt bị xóa hoàn toàn, không thể khôi phục. Recruiter muốn tiếp tục phải tạo Job mới.',
    label: 'Từ chối và xóa Job',
    api: rejectCompanyJobApi,
    destructive: true,
  },
  close: {
    title: 'Đóng Job?',
    description:
      'Dừng nhận hồ sơ mới và không thể mở lại Job. Các hồ sơ hiện có vẫn tiếp tục được phân công, xử lý.',
    label: 'Đóng Job',
    api: closePublishedJobApi,
    destructive: true,
    success: 'Đã đóng Job. Các hồ sơ hiện có tiếp tục được xử lý.',
  },
}

function CompanyJobDetail({ jobId }) {
  const resource = useResource(getRecruiterJobApi, jobId)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  if (resource.loading) return <ListSkeleton label="Đang tải chi tiết Job" />
  if (resource.error)
    return <ErrorState error={resource.error} onRetry={resource.reload} />
  const job = resource.data.job
  const status = getEffectiveJobStatus(job)
  const tabs = [
    { key: 'overview', label: 'Nội dung' },
    { key: 'team', label: 'Đội tuyển dụng' },
    ...(status === JOB_STATUS.PENDING_APPROVAL
      ? []
      : [{ key: 'applications', label: 'Phân công hồ sơ' }]),
  ]
  const tab =
    tabs.find((item) => item.key === params.get('tab'))?.key ?? 'overview'
  const copy = actions[pending]
  const confirm = async () => {
    setBusy(true)
    setFailure('')
    setMessage('')
    try {
      await copy.api(job.id)
      if (pending === 'reject') {
        navigate('/company/jobs', {
          replace: true,
          state: {
            flash: {
              type: FLASH_MESSAGE_TYPE.SUCCESS,
              title: 'Đã từ chối Job',
              message:
                'Đã xóa Job chờ duyệt. Recruiter cần tạo Job mới để tiếp tục.',
            },
          },
        })
        return
      }
      setMessage(copy.success)
    } catch (error) {
      setFailure(companyErrorMessage(error))
    } finally {
      setBusy(false)
      setPending(null)
      resource.reload()
    }
  }
  return (
    <div className="space-y-5">
      <Link className="text-sm text-primary hover:underline" to="/company/jobs">
        ← Danh sách Job
      </Link>
      <PageHeader
        actions={<JobStatusBadge status={status} />}
        title={job.title}
      />
      {message && (
        <p
          className="rounded-md bg-success p-3 text-sm text-success-foreground"
          role="status"
        >
          {message}
        </p>
      )}
      {failure && (
        <p
          className="rounded-md border border-destructive/30 p-3 text-sm text-destructive"
          role="alert"
        >
          {failure}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {status === JOB_STATUS.PENDING_APPROVAL && (
          <>
            <Button
              disabled={busy || resource.refreshing}
              onClick={() => setPending('approve')}
            >
              Duyệt và đăng Job
            </Button>
            <Button
              className="text-destructive"
              disabled={busy || resource.refreshing}
              onClick={() => setPending('reject')}
              variant="outline"
            >
              Từ chối và xóa Job
            </Button>
          </>
        )}
        {status === JOB_STATUS.PUBLISHED && (
          <Button
            className="text-destructive"
            disabled={busy || resource.refreshing}
            onClick={() => setPending('close')}
            variant="outline"
          >
            Đóng Job
          </Button>
        )}
      </div>
      <nav
        aria-label="Các mục quản lý Job"
        className="flex flex-wrap gap-1 border-b"
      >
        {tabs.map((item) => (
          <button
            aria-current={tab === item.key ? 'page' : undefined}
            className={cn(
              'border-b-2 px-3 py-2.5 text-sm',
              tab === item.key
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground',
            )}
            key={item.key}
            onClick={() =>
              setParams(item.key === 'overview' ? {} : { tab: item.key })
            }
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>
      {tab === 'overview' && (
        <>
          <dl className="grid gap-4 rounded-xl border bg-card p-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">
                Người tạo · mã thành viên
              </dt>
              <dd className="mt-1 break-all">{job.createdByCompanyMemberId}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                Primary hiện tại · mã thành viên
              </dt>
              <dd className="mt-1 break-all">
                {job.primaryRecruiterCompanyMemberId}
              </dd>
            </div>
          </dl>
          <JobOverviewTab
            isPrimary={false}
            job={job}
            onChanged={resource.reload}
          />
        </>
      )}
      {tab === 'team' && (
        <JobTeamTab isManager job={job} onChanged={resource.reload} />
      )}
      {tab === 'applications' && <CompanyJobApplications job={job} />}
      <ConfirmDialog
        busy={busy}
        confirmDisabled={resource.refreshing}
        confirmLabel={copy?.label}
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

export default CompanyJobDetail
