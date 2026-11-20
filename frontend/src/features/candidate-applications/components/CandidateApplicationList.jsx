import { CircleX, LoaderCircle, RotateCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import CenteredState from '@/components/common/CenteredState'
import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import useDiscoveryCatalogs from '@/features/job-discovery/hooks/useDiscoveryCatalogs'
import { APPLICATION_STATUS } from '@/utils/constant'

import useCandidateApplications from '../hooks/useCandidateApplications'
import {
  APPLICATION_LIST_STATUS_TABS,
  APPLICATION_STATUS_LABEL,
  computeApplicationListStats,
} from '../utils'
import ApplicationListCard from './ApplicationListCard'
import ApplicationListStats from './ApplicationListStats'
import ApplicationListToolbar from './ApplicationListToolbar'
import WithdrawApplicationModal from './WithdrawApplicationModal'

const QUICK_FILTER_STATUSES = Object.freeze({
  all: null,
  reviewing: [APPLICATION_STATUS.SCREENING, APPLICATION_STATUS.CONTACTED],
  interviewing: [
    APPLICATION_STATUS.INTERVIEW_SCHEDULED,
    APPLICATION_STATUS.INTERVIEW_COMPLETED,
  ],
  hired: [APPLICATION_STATUS.HIRED],
})

function CandidateApplicationList() {
  const { provinceNameByCode } = useDiscoveryCatalogs()
  const [status, setStatus] = useState(null)
  const [quickFilter, setQuickFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [withdrawTarget, setWithdrawTarget] = useState(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const { loading, applications, allApplications, error, reload, replaceApplication } =
    useCandidateApplications({
      status,
      q: debouncedQuery,
    })

  const stats = useMemo(
    () => computeApplicationListStats(allApplications),
    [allApplications],
  )

  const countsByStatus = useMemo(() => {
    const counts = Object.fromEntries(
      APPLICATION_LIST_STATUS_TABS.map((tabStatus) => [tabStatus, 0]),
    )
    for (const application of allApplications) {
      if (counts[application.status] != null) {
        counts[application.status] += 1
      }
    }
    return counts
  }, [allApplications])

  const effectiveStatus =
    !loading && status && (countsByStatus[status] ?? 0) === 0 ? null : status

  const visibleApplications = useMemo(() => {
    const allowedStatuses = QUICK_FILTER_STATUSES[quickFilter]
    if (!allowedStatuses || effectiveStatus) {
      return applications
    }
    const allowedSet = new Set(allowedStatuses)
    return applications.filter((item) => allowedSet.has(item.status))
  }, [applications, quickFilter, effectiveStatus])

  const handleStatusChange = (nextStatus) => {
    setStatus(nextStatus)
    setQuickFilter('all')
  }

  const handleQuickFilter = (nextQuickFilter) => {
    setQuickFilter(nextQuickFilter)
    if (nextQuickFilter === 'hired') {
      setStatus(APPLICATION_STATUS.HIRED)
    } else {
      setStatus(null)
    }
  }

  const activeQuickFilter = effectiveStatus
    ? effectiveStatus === APPLICATION_STATUS.HIRED
      ? 'hired'
      : null
    : quickFilter

  const handleInterviewUpdated = (applicationId, interviewSchedule) => {
    const current =
      applications.find((item) => item.id === applicationId) ||
      allApplications.find((item) => item.id === applicationId)
    if (!current) {
      reload()
      return
    }
    replaceApplication({
      ...current,
      interviewSchedules: (current.interviewSchedules ?? []).map((item) =>
        item.id === interviewSchedule.id ? interviewSchedule : item,
      ),
    })
  }

  const hasFilter = Boolean(debouncedQuery || effectiveStatus || quickFilter !== 'all')

  const emptyTitle = debouncedQuery
    ? 'Không tìm thấy đơn phù hợp'
    : effectiveStatus
      ? `Không có đơn ở trạng thái “${APPLICATION_STATUS_LABEL[effectiveStatus] ?? effectiveStatus}”`
      : quickFilter !== 'all'
        ? 'Không có đơn trong nhóm này'
        : 'Chưa có đơn ứng tuyển'

  const emptyDescription = debouncedQuery
    ? 'Thử đổi từ khóa hoặc xóa bộ lọc tìm kiếm.'
    : effectiveStatus || quickFilter !== 'all'
      ? 'Chọn “Tất cả” hoặc bộ lọc khác để xem các đơn còn lại.'
      : 'Khi bạn nộp hồ sơ cho một việc làm, đơn sẽ xuất hiện tại đây.'

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <Button asChild>
            <Link to="/jobs">Khám phá việc làm mới</Link>
          </Button>
        }
        description={
          loading
            ? 'Đang tải danh sách đơn ứng tuyển…'
            : `${stats.total} đơn ứng tuyển`
        }
        eyebrow="Ứng viên"
        title="Đơn ứng tuyển của tôi"
      />

      {!loading && !error ? (
        <ApplicationListStats
          activeQuickFilter={activeQuickFilter}
          onQuickFilter={handleQuickFilter}
          stats={stats}
        />
      ) : null}

      {!error ? (
        <ApplicationListToolbar
          countsByStatus={countsByStatus}
          onClearSearch={() => setSearchInput('')}
          onSearchInputChange={setSearchInput}
          onStatusChange={handleStatusChange}
          searchInput={searchInput}
          status={effectiveStatus}
          totalCount={stats.total}
        />
      ) : null}

      {loading ? (
        <CenteredState
          icon={LoaderCircle}
          spinning
          title="Đang tải đơn ứng tuyển…"
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
          description={error.message || 'Không tải được danh sách đơn.'}
          icon={CircleX}
          title="Không tải được đơn ứng tuyển"
          tone="bg-secondary text-muted-foreground"
        />
      ) : null}

      {!loading && !error && visibleApplications.length === 0 ? (
        <CenteredState
          action={
            hasFilter ? (
              <Button
                onClick={() => {
                  setStatus(null)
                  setQuickFilter('all')
                  setSearchInput('')
                }}
                variant="outline"
              >
                Xóa bộ lọc
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link to="/jobs">Tìm việc để ứng tuyển</Link>
              </Button>
            )
          }
          description={emptyDescription}
          icon={debouncedQuery ? Search : CircleX}
          title={emptyTitle}
          tone="bg-secondary text-muted-foreground"
        />
      ) : null}

      {!loading && !error && visibleApplications.length > 0 ? (
        <section className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            Hiển thị {visibleApplications.length} đơn
            {hasFilter ? ' theo bộ lọc hiện tại' : null}
          </p>
          <ul className="space-y-3">
            {visibleApplications.map((application) => (
              <li key={application.id}>
                <ApplicationListCard
                  application={application}
                  onInterviewUpdated={handleInterviewUpdated}
                  onWithdraw={setWithdrawTarget}
                  provinceNameByCode={provinceNameByCode}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {withdrawTarget ? (
        <WithdrawApplicationModal
          application={withdrawTarget}
          onClose={() => setWithdrawTarget(null)}
          onWithdrawn={() => {
            setWithdrawTarget(null)
            reload()
          }}
        />
      ) : null}
    </div>
  )
}

export default CandidateApplicationList
