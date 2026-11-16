import { CircleX, LoaderCircle, RotateCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import CenteredState from '@/components/common/CenteredState'
import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import useDiscoveryCatalogs from '@/features/job-discovery/hooks/useDiscoveryCatalogs'

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

function CandidateApplicationList() {
  const { provinceNameByCode } = useDiscoveryCatalogs()
  const [status, setStatus] = useState(null)
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

  // If current status tab becomes empty after data refresh, return to "Tất cả".
  useEffect(() => {
    if (loading || !status) {
      return
    }
    if ((countsByStatus[status] ?? 0) === 0) {
      setStatus(null)
    }
  }, [loading, status, countsByStatus])

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

  const emptyTitle = debouncedQuery
    ? 'Không tìm thấy đơn phù hợp'
    : status
      ? `Không có đơn ở trạng thái “${APPLICATION_STATUS_LABEL[status] ?? status}”`
      : 'Chưa có đơn ứng tuyển'

  const emptyDescription = debouncedQuery
    ? 'Thử đổi từ khóa hoặc xóa bộ lọc tìm kiếm.'
    : status
      ? 'Bộ lọc đang hoạt động. Chọn “Tất cả” hoặc tab khác có số lượng > 0 để xem đơn.'
      : 'Khi bạn nộp hồ sơ cho một việc làm, đơn sẽ xuất hiện tại đây.'

  return (
    <div className="space-y-6">
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

      {!loading && !error ? <ApplicationListStats stats={stats} /> : null}

      {!error ? (
        <ApplicationListToolbar
          countsByStatus={countsByStatus}
          onClearSearch={() => setSearchInput('')}
          onSearchInputChange={setSearchInput}
          onStatusChange={setStatus}
          searchInput={searchInput}
          status={status}
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

      {!loading && !error && applications.length === 0 ? (
        <CenteredState
          action={
            debouncedQuery || status ? (
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

      {!loading && !error && applications.length > 0 ? (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Hiển thị {applications.length} đơn
            {status || debouncedQuery ? ' theo bộ lọc hiện tại' : null}
          </p>
          <ul className="space-y-3">
            {applications.map((application) => (
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
