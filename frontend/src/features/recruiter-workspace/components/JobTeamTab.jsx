import { UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  addSupportingRecruiterApi,
  getJobTeamApi,
  listSupportingOptionsApi,
  listAssignmentOptionsApi,
  removeSupportingRecruiterApi,
  replaceJobPrimaryApi,
} from '@/apis/recruiter-job.api'
import { ErrorState, ListSkeleton, Pager } from '@/components/common/ListStates'
import { Button } from '@/components/ui/button'
import { JOB_STATUS } from '@/utils/constant'

import { useDebouncedValue } from '../hooks/useListSearch'
import useResource from '../hooks/useResource'
import { getEffectiveJobStatus, toRecruiterErrorMessage } from '../utils'
import ConfirmDialog from './ConfirmDialog'
import Panel, { Avatar, SearchInput } from './Panel'

const loadOptions = ({ jobId, query }) => listSupportingOptionsApi(jobId, query)
const loadPrimaryOptions = ({ jobId, query }) =>
  listAssignmentOptionsApi(jobId, query)

function ReplacePrimaryDialog({ jobId, supporting, onClose, onDone }) {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState('')
  const [keep, setKeep] = useState(true)
  const [busy, setBusy] = useState(false)
  const params = useMemo(
    () => ({ jobId, query: { page, limit: 20 } }),
    [jobId, page],
  )
  const { data, loading, refreshing, error, reload } = useResource(
    loadPrimaryOptions,
    params,
  )
  const members = (data?.recruiters ?? []).filter((member) =>
    supporting.some((item) => item.companyMemberId === member.companyMemberId),
  )
  const confirm = async () => {
    setBusy(true)
    try {
      await replaceJobPrimaryApi(jobId, {
        newPrimaryCompanyMemberId: selected,
        keepOldPrimaryAsSupporting: keep,
      })
      toast.success('Đã thay Primary Recruiter.')
    } catch (failure) {
      toast.error(toRecruiterErrorMessage(failure))
    } finally {
      setBusy(false)
      onDone()
    }
  }
  return (
    <ConfirmDialog
      busy={busy}
      confirmDisabled={
        loading ||
        refreshing ||
        Boolean(error) ||
        !members.some((member) => member.companyMemberId === selected)
      }
      confirmLabel="Thay Primary"
      description="Primary mới phải là Supporting hợp lệ của chính Job này."
      onCancel={onClose}
      onConfirm={confirm}
      open
      title="Thay Primary Recruiter"
    >
      {loading ? (
        <ListSkeleton rows={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          {members.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Chưa có Supporting hợp lệ trong trang này. Thêm Supporting trước
              nếu đội chưa có người hỗ trợ.
            </p>
          )}
          {members.map((member) => (
            <label
              className="flex items-center gap-2 py-2 text-sm"
              key={member.companyMemberId}
            >
              <input
                checked={selected === member.companyMemberId}
                name="new-primary"
                onChange={() => setSelected(member.companyMemberId)}
                type="radio"
              />
              {member.fullName}
            </label>
          ))}
          <Pager
            onPageChange={(value) => {
              setPage(value)
              setSelected('')
            }}
            pagination={data?.pagination}
            unit="thành viên"
          />
        </>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input
          checked={keep}
          className="mt-1"
          onChange={(e) => setKeep(e.target.checked)}
          type="checkbox"
        />
        Giữ Primary cũ làm Supporting
      </label>
      <p className="text-sm text-muted-foreground">
        Nếu Primary cũ rời đội, hồ sơ chưa kết thúc đang giao cho họ sẽ về Chưa
        phân công. Không tự giao hồ sơ sang Primary mới.
      </p>
    </ConfirmDialog>
  )
}

function MemberRow({ member, role, action }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar person={member} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold break-words">
          {member?.fullName ?? 'Không còn thông tin'}
        </p>
        <p className="text-xs text-muted-foreground">
          {[role, member?.jobTitle].filter(Boolean).join(' · ')}
        </p>
      </div>
      {action}
    </li>
  )
}

function AddSupportingDialog({ jobId, onClose, onAdded }) {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const q = useDebouncedValue(keyword.trim())
  const params = useMemo(
    () => ({ jobId, query: { page, limit: 10, ...(q ? { q } : {}) } }),
    [jobId, page, q],
  )
  const { data, loading, refreshing, error, reload } = useResource(
    loadOptions,
    params,
  )

  const confirm = async () => {
    setBusy(true)
    try {
      await addSupportingRecruiterApi(jobId, selected)
      toast.success('Đã thêm người hỗ trợ.')
      onAdded()
    } catch (addError) {
      toast.error(toRecruiterErrorMessage(addError))
      setSelected('')
      reload()
    } finally {
      setBusy(false)
    }
  }

  let list
  if (loading) list = <ListSkeleton label="Đang tải danh sách" rows={3} />
  else if (error)
    list = <ErrorState className="py-6" error={error} onRetry={reload} />
  else if (data.recruiters.length === 0) {
    list = (
      <p className="py-4 text-sm text-muted-foreground">
        Không còn nhà tuyển dụng nào phù hợp.
      </p>
    )
  } else {
    list = (
      <>
        <ul className="max-h-64 divide-y overflow-y-auto">
          {data.recruiters.map((member) => (
            <li key={member.companyMemberId}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
                <input
                  checked={selected === member.companyMemberId}
                  className="size-4 accent-primary"
                  name="supporting"
                  onChange={() => setSelected(member.companyMemberId)}
                  type="radio"
                />
                <Avatar className="size-8" person={member} />
                <span className="text-sm">
                  <span className="block font-medium">{member.fullName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {member.jobTitle}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <Pager
          onPageChange={setPage}
          pagination={data.pagination}
          unit="người"
        />
      </>
    )
  }

  return (
    <ConfirmDialog
      busy={busy}
      confirmDisabled={
        loading ||
        refreshing ||
        Boolean(error) ||
        !(data?.recruiters ?? []).some(
          (member) => member.companyMemberId === selected,
        )
      }
      confirmLabel="Thêm vào đội"
      description="Chọn một nhà tuyển dụng đang hoạt động trong công ty."
      onCancel={onClose}
      onConfirm={confirm}
      open
      title="Thêm người hỗ trợ"
    >
      <SearchInput
        label="Tìm theo tên hoặc chức danh"
        onChange={(value) => {
          setKeyword(value)
          setPage(1)
          setSelected('')
        }}
        value={keyword}
      />
      {list}
    </ConfirmDialog>
  )
}

function JobTeamTab({ job, isPrimary, isManager = false, onChanged }) {
  const { data, loading, refreshing, error, reload } = useResource(
    getJobTeamApi,
    job.id,
  )
  const [adding, setAdding] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)
  const canManage =
    !refreshing &&
    (isPrimary || isManager) &&
    getEffectiveJobStatus(job) === JOB_STATUS.PUBLISHED

  if (loading) return <ListSkeleton label="Đang tải đội tuyển dụng" rows={3} />
  if (error) {
    return (
      <ErrorState
        error={error}
        forbiddenDescription="Không xem được đội tuyển dụng của tin đã kết thúc, hoặc bạn không còn trong đội."
        onRetry={reload}
      />
    )
  }

  const team = data.team
  const supporting = team.supportingRecruiters ?? []

  const remove = async () => {
    setBusy(true)
    try {
      await removeSupportingRecruiterApi(job.id, removing.companyMemberId)
      toast.success('Đã gỡ khỏi đội tuyển dụng.')
      reload()
    } catch (removeError) {
      toast.error(
        removeError.status === 409
          ? 'Không gỡ được: người này còn trách nhiệm chưa chuyển giao hoặc đội đã thay đổi.'
          : toRecruiterErrorMessage(removeError),
      )
      reload()
    } finally {
      setBusy(false)
      setRemoving(null)
    }
  }

  return (
    <div className="space-y-4">
      <Panel
        actions={
          isManager &&
          canManage && (
            <Button
              onClick={() => setReplacing(true)}
              size="sm"
              variant="outline"
            >
              Thay Primary
            </Button>
          )
        }
        title="Phụ trách chính"
      >
        <ul>
          <MemberRow member={team.primaryRecruiter} role="Phụ trách chính" />
        </ul>
      </Panel>
      <Panel
        actions={
          canManage && (
            <Button onClick={() => setAdding(true)} size="sm" type="button">
              <UserPlus aria-hidden="true" className="size-4" />
              Thêm người hỗ trợ
            </Button>
          )
        }
        title={`Người hỗ trợ (${supporting.length})`}
      >
        {supporting.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có người hỗ trợ.</p>
        ) : (
          <ul className="divide-y">
            {supporting.map((member) => (
              <MemberRow
                action={
                  canManage && (
                    <Button
                      aria-label={`Gỡ ${member.fullName} khỏi đội`}
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setRemoving(member)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Gỡ
                    </Button>
                  )
                }
                key={member.companyMemberId}
                member={member}
                role="Hỗ trợ"
              />
            ))}
          </ul>
        )}
        {!canManage && (
          <p className="mt-3 text-xs text-muted-foreground">
            {isManager
              ? 'Đội chỉ được thay đổi khi Job còn hiệu lực tuyển dụng.'
              : 'Chỉ người phụ trách chính thay đổi được đội, và chỉ khi tin đang tuyển.'}
          </p>
        )}
      </Panel>

      {adding && (
        <AddSupportingDialog
          jobId={job.id}
          onAdded={() => {
            setAdding(false)
            reload()
          }}
          onClose={() => setAdding(false)}
        />
      )}
      {replacing && (
        <ReplacePrimaryDialog
          jobId={job.id}
          supporting={supporting}
          onClose={() => setReplacing(false)}
          onDone={() => {
            setReplacing(false)
            reload()
            onChanged?.()
          }}
        />
      )}
      <ConfirmDialog
        busy={busy}
        confirmLabel="Gỡ khỏi đội"
        description={`${
          removing?.fullName ?? ''
        } sẽ rời đội. Hồ sơ chưa kết thúc đang giao cho họ sẽ về Chưa phân công; dữ liệu lịch sử được giữ lại.`}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={remove}
        open={Boolean(removing)}
        title="Gỡ người hỗ trợ?"
      />
    </div>
  )
}

export default JobTeamTab
