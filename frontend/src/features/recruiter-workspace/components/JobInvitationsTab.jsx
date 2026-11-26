import { MailOpen } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { listJobInvitationsApi, revokeJobInvitationApi } from '@/apis/recruiter-sourcing.api'
import { ErrorState, ListSkeleton, Pager, StateMessage } from '@/components/common/ListStates'
import { Button } from '@/components/ui/button'
import { SelectDropdown } from '@/components/ui/select-dropdown'
import {
  JOB_INVITATION_STATUS_LABEL,
  JOB_INVITATION_STATUS_TONE,
} from '@/features/candidate-invitations/utils'
import { cn } from '@/lib/utils'

import useListSearch, { toListQuery, useDebouncedValue } from '../hooks/useListSearch'
import useResource from '../hooks/useResource'
import {
  INVITATION_INVALIDATION_LABEL,
  INVITATION_STATUS_OPTIONS,
  formatMoment,
  toRecruiterErrorMessage,
} from '../utils'
import ConfirmDialog from './ConfirmDialog'
import DataTable from './DataTable'
import { Avatar, FilterBar, ListCard, SearchInput } from './Panel'

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Tạo mới nhất' },
  { value: 'createdAt', label: 'Tạo cũ nhất' },
  { value: '-sentAt', label: 'Gửi mới nhất' },
  { value: 'sentAt', label: 'Gửi cũ nhất' },
]
const SEARCH_SPEC = Object.freeze({
  q: 'text',
  status: ['', ...INVITATION_STATUS_OPTIONS],
  sort: SORT_OPTIONS.map((option) => option.value),
})

const loadInvitations = ({ jobId, query }) => listJobInvitationsApi(jobId, query)

function invitationColumns(onRevoke) {
  return [
    {
      header: 'Ứng viên',
      cell: (invitation) => (
        <span className="flex min-w-44 items-center gap-3 font-semibold">
          <Avatar person={invitation.candidate} />
          <span className="break-words">{invitation.candidate?.fullName ?? 'Ứng viên'}</span>
        </span>
      ),
    },
    { header: 'CV được mời', cell: (invitation) => invitation.invitedCvSnapshot?.name ?? 'Không rõ' },
    {
      header: 'Người gửi',
      cell: (invitation) => (
        <span className="block min-w-36">
          <span className="block font-medium">{invitation.sender?.fullName ?? 'Không rõ'}</span>
          <span className="block text-xs text-muted-foreground">{invitation.sender?.jobTitle}</span>
        </span>
      ),
    },
    {
      header: 'Lời nhắn',
      cell: (invitation) => (
        <span className="block max-w-64 min-w-40 break-words whitespace-pre-wrap text-muted-foreground">
          {invitation.greetingMessage || '—'}
        </span>
      ),
    },
    {
      header: 'Trạng thái',
      cell: (invitation) => (
        <span className="block">
          <span
            className={cn(
              'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
              JOB_INVITATION_STATUS_TONE[invitation.status],
            )}
          >
            {JOB_INVITATION_STATUS_LABEL[invitation.status] ?? invitation.status}
          </span>
          {invitation.invalidationReason && (
            <span className="mt-1 block max-w-48 text-xs text-muted-foreground">
              {INVITATION_INVALIDATION_LABEL[invitation.invalidationReason] ?? invitation.invalidationReason}
            </span>
          )}
        </span>
      ),
    },
    { header: 'Gửi lúc', className: 'whitespace-nowrap tabular-nums', cell: (invitation) => formatMoment(invitation.sentAt) },
    { header: 'Hết hạn', className: 'whitespace-nowrap tabular-nums', cell: (invitation) => formatMoment(invitation.expiresAt) },
    {
      header: 'Thao tác',
      cell: (invitation) =>
        invitation.canRevoke ? (
          <Button onClick={() => onRevoke(invitation)} size="sm" type="button" variant="outline">
            Thu hồi
          </Button>
        ) : (
          '—'
        ),
    },
  ]
}

function JobInvitationsTab({ jobId }) {
  const { search, setFilters, setPage, reset } = useListSearch(SEARCH_SPEC)
  const keyword = useDebouncedValue(search.q)
  const params = useMemo(
    () => ({ jobId, query: toListQuery({ ...search, q: keyword }) }),
    [jobId, search, keyword],
  )
  const { data, loading, error, reload } = useResource(loadInvitations, params)
  const [revoking, setRevoking] = useState(null)
  const [busy, setBusy] = useState(false)
  const hasFilters = Boolean(search.q || search.status)

  const revoke = async () => {
    setBusy(true)
    try {
      await revokeJobInvitationApi(jobId, revoking.id)
      toast.success('Đã thu hồi lời mời.')
    } catch (revokeError) {
      toast.error(toRecruiterErrorMessage(revokeError))
    } finally {
      reload()
      setBusy(false)
      setRevoking(null)
    }
  }

  let body
  if (loading) body = <ListSkeleton label="Đang tải lời mời" />
  else if (error) body = <ErrorState error={error} onRetry={reload} />
  else if (data.invitations.length === 0) {
    body = (
      <StateMessage
        action={
          hasFilters ? (
            <Button onClick={reset} size="sm" type="button" variant="outline">
              Xóa bộ lọc
            </Button>
          ) : null
        }
        description={hasFilters ? 'Không có lời mời nào khớp.' : 'Job này chưa gửi lời mời nào.'}
        icon={MailOpen}
        title={hasFilters ? 'Không có kết quả' : 'Chưa có lời mời'}
      />
    )
  } else {
    body = (
      <>
        <DataTable
          className="min-w-5xl"
          columns={invitationColumns(setRevoking)}
          label="Bảng lời mời"
          rowKey={(invitation) => invitation.id}
          rows={data.invitations}
        />
        <Pager onPageChange={setPage} pagination={data.pagination} unit="lời mời" />
      </>
    )
  }

  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchInput
          label="Tìm theo tên ứng viên hoặc người gửi"
          onChange={(q) => setFilters({ q })}
          value={search.q}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:flex">
          <SelectDropdown
            ariaLabel="Lọc theo trạng thái"
            className="lg:w-48"
            onChange={(status) => setFilters({ status })}
            options={[
              { value: '', label: 'Mọi trạng thái' },
              ...INVITATION_STATUS_OPTIONS.map((value) => ({
                value,
                label: JOB_INVITATION_STATUS_LABEL[value],
              })),
            ]}
            value={search.status}
          />
          <SelectDropdown
            ariaLabel="Sắp xếp"
            className="lg:w-40"
            onChange={(sort) => setFilters({ sort })}
            options={SORT_OPTIONS}
            value={search.sort}
          />
        </div>
      </FilterBar>
      <ListCard label="Lời mời ứng tuyển">{body}</ListCard>
      <ConfirmDialog
        busy={busy}
        confirmLabel="Thu hồi"
        description="Ứng viên sẽ không thể chấp nhận hay từ chối lời mời này nữa."
        destructive
        onCancel={() => setRevoking(null)}
        onConfirm={revoke}
        open={Boolean(revoking)}
        title="Thu hồi lời mời?"
      />
    </div>
  )
}

export default JobInvitationsTab
