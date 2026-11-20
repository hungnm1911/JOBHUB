import { CircleX, LoaderCircle, RotateCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import useDiscoveryCatalogs from '@/features/job-discovery/hooks/useDiscoveryCatalogs'

import useCandidateInvitations from '../hooks/useCandidateInvitations'
import {
  INVITATION_FILTER_TABS,
  INVITATION_SORT,
  JOB_INVITATION_STATUS_LABEL,
  computeInvitationStats,
  matchesInvitationSearch,
  sortInvitations,
} from '../utils'
import AcceptInvitationModal from './AcceptInvitationModal'
import InvitationCard from './InvitationCard'
import InvitationListToolbar from './InvitationListToolbar'
import RejectInvitationModal from './RejectInvitationModal'

function CandidateInvitationList() {
  const { provinceNameByCode } = useDiscoveryCatalogs()
  const { loading, invitations, error, reload, replaceInvitation } = useCandidateInvitations()

  const [status, setStatus] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sort, setSort] = useState(INVITATION_SORT.NEWEST)
  const [acceptTarget, setAcceptTarget] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const stats = useMemo(() => computeInvitationStats(invitations), [invitations])

  const countsByStatus = useMemo(() => {
    const counts = Object.fromEntries(INVITATION_FILTER_TABS.map((tabStatus) => [tabStatus, 0]))
    for (const invitation of invitations) {
      if (counts[invitation.status] != null) {
        counts[invitation.status] += 1
      }
    }
    return counts
  }, [invitations])

  const activeStatus =
    !loading && status && (countsByStatus[status] ?? 0) === 0 ? null : status

  const visibleInvitations = useMemo(() => {
    const filtered = invitations.filter((invitation) => {
      if (activeStatus && invitation.status !== activeStatus) {
        return false
      }
      return matchesInvitationSearch(invitation, debouncedQuery)
    })
    return sortInvitations(filtered, sort)
  }, [invitations, activeStatus, debouncedQuery, sort])

  const emptyTitle = debouncedQuery
    ? 'Không tìm thấy lời mời phù hợp'
    : activeStatus
      ? `Không có lời mời ở trạng thái “${JOB_INVITATION_STATUS_LABEL[activeStatus] ?? activeStatus}”`
      : 'Chưa có lời mời'

  const emptyDescription = debouncedQuery
    ? 'Thử đổi từ khóa hoặc xóa bộ lọc tìm kiếm.'
    : activeStatus
      ? 'Bộ lọc đang hoạt động. Chọn “Tất cả” hoặc tab khác có số lượng > 0 để xem lời mời.'
      : 'Khi nhà tuyển dụng gửi lời mời ứng tuyển, bạn sẽ thấy chúng tại đây.'

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Lời mời ứng tuyển</h1>
            {!loading && !error && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {stats.total} lời mời
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Các lời mời trực tiếp từ nhà tuyển dụng qua JOBHUB. Xem chi tiết JD và phản hồi trước
            khi hết hạn.
          </p>

          {!loading && !error && invitations.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full bg-amber-500" />
                Chờ phản hồi:{' '}
                <strong className="font-semibold text-foreground">{stats.pending}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />
                Đã chấp nhận:{' '}
                <strong className="font-semibold text-foreground">{stats.accepted}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full bg-rose-500" />
                Đã từ chối:{' '}
                <strong className="font-semibold text-foreground">{stats.rejected}</strong>
              </span>
            </div>
          )}
        </div>
      </header>

      {!error && !loading && invitations.length > 0 ? (
        <InvitationListToolbar
          countsByStatus={countsByStatus}
          onClearSearch={() => setSearchInput('')}
          onSearchInputChange={setSearchInput}
          onSortChange={setSort}
          onStatusChange={setStatus}
          searchInput={searchInput}
          sort={sort}
          status={activeStatus}
          totalCount={stats.total}
        />
      ) : null}

      {loading ? (
        <CenteredState
          icon={LoaderCircle}
          spinning
          title="Đang tải lời mời ứng tuyển…"
          tone="bg-primary/10 text-primary"
        />
      ) : null}

      {!loading && error ? (
        <CenteredState
          action={
            <Button onClick={reload} variant="outline">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          }
          description={error.message || 'Không tải được danh sách lời mời.'}
          icon={CircleX}
          title="Không tải được lời mời ứng tuyển"
          tone="bg-secondary text-muted-foreground"
        />
      ) : null}

      {!loading && !error && visibleInvitations.length === 0 ? (
        <CenteredState
          action={
            debouncedQuery || activeStatus ? (
              <Button
                onClick={() => {
                  setStatus(null)
                  setSearchInput('')
                }}
                variant="outline"
              >
                Xóa bộ lọc
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link to="/candidate/cvs">Hoàn thiện CV</Link>
              </Button>
            )
          }
          description={emptyDescription}
          icon={debouncedQuery ? Search : CircleX}
          title={emptyTitle}
          tone="bg-secondary text-muted-foreground"
        />
      ) : null}

      {!loading && !error && visibleInvitations.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {visibleInvitations.map((invitation) => (
            <li key={invitation.id}>
              <InvitationCard
                invitation={invitation}
                onAccept={setAcceptTarget}
                onReject={setRejectTarget}
                provinceNameByCode={provinceNameByCode}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {acceptTarget ? (
        <AcceptInvitationModal
          invitation={acceptTarget}
          onAccepted={(nextInvitation) => {
            replaceInvitation(nextInvitation)
            setAcceptTarget(null)
          }}
          onClose={() => setAcceptTarget(null)}
        />
      ) : null}

      {rejectTarget ? (
        <RejectInvitationModal
          invitation={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onRejected={(nextInvitation) => {
            replaceInvitation(nextInvitation)
            setRejectTarget(null)
          }}
        />
      ) : null}
    </div>
  )
}

export default CandidateInvitationList
