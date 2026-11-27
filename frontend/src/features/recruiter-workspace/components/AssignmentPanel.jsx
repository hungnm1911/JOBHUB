import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import {
  assignApplicationApi,
  reassignApplicationApi,
  unassignApplicationApi,
} from '@/apis/recruiter-application.api'
import { listAssignmentOptionsApi } from '@/apis/recruiter-job.api'
import { ErrorState, ListSkeleton, Pager } from '@/components/common/ListStates'
import { Button } from '@/components/ui/button'
import { JOB_STATUS } from '@/utils/constant'

import useResource from '../hooks/useResource'
import { useDebouncedValue } from '../hooks/useListSearch'
import {
  TERMINAL_STATUSES,
  getEffectiveJobStatus,
  toRecruiterErrorMessage,
} from '../utils'
import ConfirmDialog from './ConfirmDialog'
import Panel, { Avatar, SearchInput } from './Panel'

const loadOptions = ({ jobId, query }) => listAssignmentOptionsApi(jobId, query)

const ASSIGNABLE_JOB_STATUSES = [
  JOB_STATUS.PUBLISHED,
  JOB_STATUS.CLOSED,
  JOB_STATUS.EXPIRED,
]

function AssignDialog({ jobId, application, membershipId, onClose, onDone }) {
  const current = application.assignedRecruiterCompanyMemberId
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebouncedValue(keyword.trim())
  const params = useMemo(
    () => ({ jobId, query: { page, limit: 10, ...(q ? { q } : {}) } }),
    [jobId, page, q],
  )
  const { data, loading, refreshing, error, reload } = useResource(
    loadOptions,
    params,
  )
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const options = (data?.recruiters ?? []).filter(
    (item) => item.companyMemberId !== current,
  )

  const confirm = async () => {
    setBusy(true)
    try {
      if (current) {
        await reassignApplicationApi(jobId, application.id, {
          assigneeCompanyMemberId: selected,
          expectedAssigneeCompanyMemberId: current,
          expectedVersion: application.version,
        })
      } else {
        await assignApplicationApi(jobId, application.id, {
          assigneeCompanyMemberId: selected,
          expectedVersion: application.version,
        })
      }
      toast.success(current ? 'Đã đổi người xử lý.' : 'Đã phân công hồ sơ.')
      onDone()
    } catch (assignError) {
      toast.error(toRecruiterErrorMessage(assignError))
      onDone()
    } finally {
      setBusy(false)
    }
  }

  let list
  if (loading) list = <ListSkeleton label="Đang tải đội tuyển dụng" rows={3} />
  else if (error)
    list = <ErrorState className="py-6" error={error} onRetry={reload} />
  else if (options.length === 0) {
    list = (
      <p className="text-sm text-muted-foreground">
        Không còn ai trong đội đủ điều kiện nhận hồ sơ.
      </p>
    )
  } else {
    list = (
      <ul className="max-h-72 divide-y overflow-y-auto">
        {options.map((member) => (
          <li key={member.companyMemberId}>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
              <input
                checked={selected === member.companyMemberId}
                className="size-4 accent-primary"
                name="assignee"
                onChange={() => setSelected(member.companyMemberId)}
                type="radio"
              />
              <Avatar className="size-8" person={member} />
              <span className="text-sm">
                <span className="block font-medium">
                  {member.fullName}
                  {member.companyMemberId === membershipId
                    ? ' (bạn nhận xử lý)'
                    : ''}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {member.jobTitle}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ConfirmDialog
      busy={busy}
      confirmDisabled={
        loading ||
        refreshing ||
        Boolean(error) ||
        !options.some((item) => item.companyMemberId === selected)
      }
      confirmLabel="Xác nhận"
      description="Trạng thái tuyển dụng của hồ sơ được giữ nguyên."
      onCancel={onClose}
      onConfirm={confirm}
      open
      title={current ? 'Đổi người xử lý' : 'Phân công hồ sơ'}
    >
      <SearchInput
        label="Tìm người nhận hồ sơ"
        onChange={(value) => {
          setKeyword(value)
          setPage(1)
          setSelected('')
        }}
        value={keyword}
      />
      {list}
      <Pager
        onPageChange={(value) => {
          setPage(value)
          setSelected('')
        }}
        pagination={data?.pagination}
        unit="người"
      />
    </ConfirmDialog>
  )
}

function AssignmentPanel({
  job,
  application,
  membershipId,
  onChanged,
  allowProcessing = true,
  disabled = false,
}) {
  const [mode, setMode] = useState(null)
  const [busy, setBusy] = useState(false)
  const assignee = application.assignedRecruiter
  const assigneeId = application.assignedRecruiterCompanyMemberId
  const canManage =
    !disabled &&
    !TERMINAL_STATUSES.includes(application.status) &&
    ASSIGNABLE_JOB_STATUSES.includes(getEffectiveJobStatus(job))

  const unassign = async () => {
    setBusy(true)
    try {
      await unassignApplicationApi(job.id, application.id, {
        expectedAssigneeCompanyMemberId: assigneeId,
        expectedVersion: application.version,
      })
      toast.success('Đã bỏ phân công.')
    } catch (error) {
      toast.error(toRecruiterErrorMessage(error))
    } finally {
      onChanged()
      setBusy(false)
      setMode(null)
    }
  }

  return (
    <Panel title="Phân công">
      <div className="flex items-center gap-3">
        {assigneeId && <Avatar person={assignee} />}
        <p className="text-sm font-medium">
          {assigneeId
            ? assignee?.fullName ?? 'Không còn thông tin'
            : 'Chưa phân công'}
          {assigneeId === membershipId ? ' (bạn)' : ''}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {canManage && (
          <Button onClick={() => setMode('assign')} size="sm" type="button">
            {assigneeId ? 'Đổi người xử lý' : 'Phân công'}
          </Button>
        )}
        {canManage && assigneeId && (
          <Button
            onClick={() => setMode('unassign')}
            size="sm"
            type="button"
            variant="outline"
          >
            Bỏ phân công
          </Button>
        )}
        {allowProcessing && assigneeId && assigneeId === membershipId && (
          <Button asChild size="sm" variant="outline">
            <Link to={`/recruiter/my-applications/${application.id}`}>
              Xử lý hồ sơ
            </Link>
          </Button>
        )}
      </div>
      {mode === 'assign' && (
        <AssignDialog
          application={application}
          jobId={job.id}
          membershipId={membershipId}
          onClose={() => setMode(null)}
          onDone={() => {
            setMode(null)
            onChanged()
          }}
        />
      )}
      <ConfirmDialog
        busy={busy}
        confirmLabel="Bỏ phân công"
        description="Hồ sơ trở về trạng thái chưa phân công và tạm dừng xử lý, trò chuyện."
        destructive
        onCancel={() => setMode(null)}
        onConfirm={unassign}
        open={mode === 'unassign'}
        title="Bỏ phân công hồ sơ?"
      />
    </Panel>
  )
}

export default AssignmentPanel
