import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import {
  getCompanyRecruiterApi,
  getRecruiterHandoverApi,
  lockCompanyRecruiterApi,
  terminateCompanyRecruiterApi,
} from '@/apis/company-recruiter.api'
import { ErrorState, ListSkeleton, Pager } from '@/components/common/ListStates'
import PageHeader from '@/components/common/PageHeader'
import useUnsavedChangesPrompt from '@/components/common/UnsavedChangesProvider/hooks/useUnsavedChangesPrompt'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'
import {
  ConfirmDialog,
  JOB_STATUS_LABEL,
  useDebouncedValue,
  useResource,
} from '@/features/recruiter-workspace/public'
import { COMPANY_MEMBER_STATUS, FLASH_MESSAGE_TYPE } from '@/utils/constant'

import { companyErrorMessage } from '../utils'

function RecruiterHandover({ recruiterId }) {
  const [params] = useSearchParams()
  const terminating = params.get('intent') === 'terminate'
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [selections, setSelections] = useState({})
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const q = useDebouncedValue(keyword.trim())
  const query = useMemo(
    () => ({ recruiterId, query: { page, limit: 20, ...(q ? { q } : {}) } }),
    [recruiterId, page, q],
  )
  const resource = useResource(getRecruiterHandoverApi, query)
  const recruiter = useResource(getCompanyRecruiterApi, recruiterId)
  const { markSaved } = useUnsavedChangesPrompt(
    Object.values(selections).some(Boolean),
  )
  if (resource.loading || recruiter.loading)
    return <ListSkeleton label="Đang kiểm tra trách nhiệm cần bàn giao" />
  if (resource.error || recruiter.error)
    return (
      <ErrorState
        error={resource.error || recruiter.error}
        onRetry={() => {
          resource.reload()
          recruiter.reload()
        }}
      />
    )
  const data = resource.data
  const target = recruiter.data.recruiter
  const locked = target.membership.status === COMPANY_MEMBER_STATUS.LOCKED
  const ready =
    !busy &&
    !resource.refreshing &&
    !recruiter.refreshing &&
    (!locked || terminating) &&
    data.primaryJobs.every((job) => selections[job.jobId]?.companyMemberId)
  const confirm = async () => {
    setBusy(true)
    setFailure('')
    try {
      const transfers = data.primaryJobs.map((job) => ({
        jobId: job.jobId,
        replacementCompanyMemberId: selections[job.jobId].companyMemberId,
      }))
      await (terminating
        ? terminateCompanyRecruiterApi
        : lockCompanyRecruiterApi)(recruiterId, transfers)
      markSaved()
      navigate(`/company/recruiters/${recruiterId}`, {
        replace: true,
        state: {
          flash: {
            type: FLASH_MESSAGE_TYPE.SUCCESS,
            title: terminating
              ? 'Đã chấm dứt tư cách Recruiter'
              : 'Đã khóa Recruiter',
            message:
              'Bàn giao đã hoàn tất. Các hồ sơ chưa kết thúc của Recruiter đã về Chưa phân công.',
          },
        },
      })
    } catch (error) {
      setFailure(
        `${companyErrorMessage(
          error,
        )} Một số bước có thể đã hoàn tất. Danh sách được tải lại để bạn kiểm tra trước khi thử lại.`,
      )
      setSelections({})
      resource.reload()
      recruiter.reload()
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }
  return (
    <div className="space-y-5">
      <Link
        className="text-sm text-primary hover:underline"
        to={`/company/recruiters/${recruiterId}`}
      >
        ← Chi tiết Recruiter
      </Link>
      <PageHeader
        description={target.fullName}
        title={
          terminating ? 'Bàn giao và chấm dứt' : 'Bàn giao và khóa Recruiter'
        }
      />
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">1. Chọn Primary thay thế</h2>
        <p className="text-sm text-muted-foreground">
          Mỗi Job chưa kết thúc phải có Primary mới. Job nháp chỉ hiển thị mã
          định danh và trạng thái phục vụ bàn giao.
        </p>
        {data.primaryJobs.length === 0 ? (
          <p className="text-sm">
            Không có Job chưa kết thúc cần thay Primary.
          </p>
        ) : (
          <>
            <label className="block space-y-1 text-sm">
              <span>
                Tìm người thay thế theo tên, email, mã nhân viên hoặc chức danh
              </span>
              <Input
                onChange={(e) => {
                  setKeyword(e.target.value)
                  setPage(1)
                }}
                type="search"
                value={keyword}
              />
            </label>
            {data.primaryJobs.map((job) => {
              const selected = selections[job.jobId]
              const options =
                selected &&
                !data.recruiters.some(
                  (member) =>
                    member.companyMemberId === selected.companyMemberId,
                )
                  ? [selected, ...data.recruiters]
                  : data.recruiters
              return (
                <label
                  className="block space-y-2 border-t pt-4 text-sm"
                  key={job.jobId}
                >
                  <span className="block break-all">
                    Job {job.jobId} · {JOB_STATUS_LABEL[job.status]}
                  </span>
                  <select
                    aria-label={`Primary thay thế cho Job ${job.jobId}`}
                    className="min-h-10 w-full rounded-md border bg-card px-3"
                    disabled={busy || resource.refreshing}
                    onChange={(e) => {
                      const member = options.find(
                        (item) => item.companyMemberId === e.target.value,
                      )
                      setSelections((current) => ({
                        ...current,
                        [job.jobId]: member,
                      }))
                    }}
                    value={selected?.companyMemberId ?? ''}
                  >
                    <option value="">Chọn Recruiter hợp lệ</option>
                    {options.map((member) => (
                      <option
                        key={member.companyMemberId}
                        value={member.companyMemberId}
                      >
                        {member.fullName} · {member.jobTitle}
                      </option>
                    ))}
                  </select>
                </label>
              )
            })}
            {data.recruiters.length === 0 && (
              <p className="text-sm text-destructive">
                Không có người phù hợp trong kết quả này. Nếu công ty không có
                Recruiter đủ điều kiện thay thế, không thể hoàn tất.
              </p>
            )}
            <Pager
              onPageChange={setPage}
              pagination={data.pagination}
              unit="người thay thế"
            />
          </>
        )}
        <p className="text-sm text-muted-foreground">
          Số Job chưa kết thúc đang hỗ trợ: {data.supportingJobCount}. Recruiter
          sẽ rời các đội đang hoạt động sau khi giải quyết trách nhiệm.
        </p>
      </section>
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">2. Hồ sơ và quyền truy cập</h2>
        <p className="text-sm">
          Mọi hồ sơ chưa kết thúc đang giao cho Recruiter sẽ về{' '}
          <strong>Chưa phân công</strong>, kể cả hồ sơ thuộc Job đã đóng hoặc
          hết hạn. Giữ nguyên trạng thái tuyển dụng; có thể phân công lại sau.
        </p>
        <p className="text-sm">
          {terminating
            ? 'Chấm dứt vĩnh viễn membership và không thể mở lại.'
            : 'Membership chuyển sang LOCKED; có thể mở khóa khi đủ điều kiện.'}{' '}
          Phiên đăng nhập cũ bị thu hồi; danh tính và dữ liệu lịch sử được giữ.
        </p>
      </section>
      {failure && (
        <p
          className="rounded-md border border-destructive/30 p-4 text-sm text-destructive"
          role="alert"
        >
          {failure}
        </p>
      )}
      {locked && !terminating && (
        <p className="text-sm" role="status">
          Recruiter này đã bị khóa tại công ty.
        </p>
      )}
      <Button
        className="bg-destructive text-primary-foreground hover:bg-destructive/90"
        disabled={!ready}
        onClick={() => setOpen(true)}
      >
        {terminating ? 'Bàn giao và chấm dứt' : 'Bàn giao và khóa'}
      </Button>
      <ConfirmDialog
        busy={busy}
        confirmDisabled={!ready}
        confirmLabel={terminating ? 'Xác nhận chấm dứt' : 'Xác nhận khóa'}
        description="Các bước bàn giao có thể hoàn tất riêng lẻ. Nếu gặp lỗi, hãy kiểm tra dữ liệu tải lại trước khi thử tiếp."
        destructive
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
        open={open}
        title={
          terminating
            ? 'Chấm dứt vĩnh viễn tư cách Recruiter?'
            : 'Bàn giao và khóa Recruiter?'
        }
      />
    </div>
  )
}

export default RecruiterHandover
