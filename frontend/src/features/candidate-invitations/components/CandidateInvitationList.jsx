import { CircleX, LoaderCircle, RotateCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import CenteredState from '@/components/common/CenteredState'
import PageHeader from '@/components/common/PageHeader'
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
import InvitationListStats from './InvitationListStats'
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

  // Drop empty status tabs after accept/reject without an effect reset.
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

  const pendingHint =
    !loading && !error && stats.pending > 0
      ? ` · ${stats.pending} chờ phản hồi`
      : ''

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link to="/candidate/applications">Đơn ứng tuyển</Link>
          </Button>
        }
        description={
          loading
            ? 'Đang tải danh sách lời mời ứng tuyển…'
            : error
              ? 'Không tải được lời mời ứng tuyển.'
              : `Các lời mời từ nhà tuyển dụng qua JOBHUB.${pendingHint}`
        }
        eyebrow="Ứng viên"
        title="Lời mời ứng tuyển"
      />

      {!loading && !error ? <InvitationListStats stats={stats} /> : null}

      {!error ? (
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
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Hiển thị {visibleInvitations.length} lời mời
            {activeStatus || debouncedQuery ? ' theo bộ lọc hiện tại' : null}
          </p>
          <ul className="space-y-3">
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
        </section>
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
