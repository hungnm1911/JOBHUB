import { ArrowRight, Bell, BriefcaseBusiness, MapPin } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'

import { listExperienceLevelsApi } from '@/apis/experience-level.api'
import { listProvincesApi } from '@/apis/location.api'
import { listOwnNotificationsApi } from '@/apis/notification.api'
import { listMyApplicationsApi } from '@/apis/recruiter-application.api'
import { listRecruiterJobsApi } from '@/apis/recruiter-job.api'
import { ErrorState, ListSkeleton, Pager, StateMessage } from '@/components/common/ListStates'
import { Button } from '@/components/ui/button'
import { SelectDropdown } from '@/components/ui/select-dropdown'
import { selectMembership } from '@/features/authentication/slice'
import { ApplicationStatusBadge } from '@/features/candidate-dashboard/public'
import { EMPLOYMENT_TYPE_LABEL, formatSalary, formatWorkModes } from '@/features/job-discovery/public'
import { subscribeRealtimeEvent } from '@/socket/realtime-subscriptions'
import { useAppSelector } from '@/store/hooks'
import { JOB_STATUS, REALTIME_EVENT, SOCKET_LIFECYCLE_EVENT } from '@/utils/constant'

import useDistrictNames from '../../hooks/useDistrictNames'
import useListSearch, { toListQuery, useDebouncedValue } from '../../hooks/useListSearch'
import useResource from '../../hooks/useResource'
import { JOB_LIST_SCOPE, JOB_ROLE, formatDay, formatMoment, getEffectiveJobStatus } from '../../utils'
import JobStatusBadge, { JobRoleChip } from '../JobStatusBadge'
import { Avatar, SearchInput } from '../Panel'

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Tạo mới nhất' },
  { value: 'applicationDeadline', label: 'Hạn nhận gần nhất' },
  { value: 'title', label: 'Tiêu đề A–Z' },
]
const SCOPE_OPTIONS = [
  { value: JOB_LIST_SCOPE.COMPANY_PUBLISHED, label: 'Toàn công ty' },
  { value: JOB_LIST_SCOPE.MY_TEAM, label: 'Tôi tham gia' },
]
const SEARCH_SPEC = Object.freeze({
  q: 'text',
  scope: SCOPE_OPTIONS.map((option) => option.value),
  sort: SORT_OPTIONS.map((option) => option.value),
})
const RECENT_APPLICATIONS_QUERY = Object.freeze({ page: 1, limit: 3, sort: '-updatedAt' })
const RECENT_NOTIFICATIONS_QUERY = Object.freeze({ page: 1, limit: 3, sort: '-createdAt' })
const linkClass = 'inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring'

function HomeJobCard({ job, membershipId, location, experience }) {
  const role = job.primaryRecruiterCompanyMemberId === membershipId
    ? JOB_ROLE.PRIMARY
    : job.supportingRecruiterCompanyMemberIds?.includes(membershipId)
      ? JOB_ROLE.SUPPORTING
      : JOB_ROLE.NONE
  const path = `/recruiter/jobs/${job.id}`

  return (
    <li className="rounded-xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-secondary/50 text-primary">
          <BriefcaseBusiness aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link className="rounded-sm text-base font-semibold break-words outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring" to={path}>
              {job.title || 'Chưa đặt tiêu đề'}
            </Link>
            <JobStatusBadge status={getEffectiveJobStatus(job)} />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            <span>{[location, formatWorkModes(job.workModes)].filter(Boolean).join(' · ') || 'Chưa có địa điểm'}</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {[EMPLOYMENT_TYPE_LABEL[job.employmentType], experience].filter(Boolean).join(' · ')}
          </p>
          {job.salary && <p className="mt-3 text-sm font-semibold text-success-foreground">{formatSalary(job.salary)}</p>}
          <p className="mt-2 text-xs text-muted-foreground">Hạn nhận hồ sơ: {formatDay(job.applicationDeadline) || 'Chưa đặt'}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {role === JOB_ROLE.NONE ? <span className="text-xs text-muted-foreground">Bạn chưa tham gia đội tuyển dụng</span> : <JobRoleChip role={role} />}
            <Link className={linkClass} to={path}>Xem Job <ArrowRight aria-hidden="true" className="size-3.5" /></Link>
          </div>
        </div>
      </div>
    </li>
  )
}

function RecentApplications({ resource }) {
  let content
  if (resource.loading) content = <ListSkeleton label="Đang tải hồ sơ mới cập nhật" rows={3} />
  else if (resource.error) content = <ErrorState className="px-0 py-6" error={resource.error} onRetry={resource.reload} />
  else if (!resource.data.applications.length) content = <p className="py-5 text-sm text-muted-foreground">Hiện chưa có hồ sơ nào được giao cho bạn.</p>
  else content = (
    <ul className="divide-y">
      {resource.data.applications.map((application) => (
        <li key={application.id}>
          <Link className="flex items-start gap-3 rounded-sm py-4 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring" to={`/recruiter/my-applications/${application.id}`}>
            <Avatar person={application.candidate} />
            <span className="min-w-0 space-y-1.5">
              <span className="block text-sm font-semibold break-words">{application.candidate?.fullName || 'Ứng viên'}</span>
              <span className="block text-xs break-words text-muted-foreground">{application.job?.title}</span>
              <ApplicationStatusBadge status={application.status} />
              {!application.isActiveWorkload && <span className="block text-xs text-muted-foreground">Hồ sơ đã kết thúc · Xem lại</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
  return (
    <section aria-labelledby="home-applications-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold" id="home-applications-heading">Hồ sơ mới cập nhật</h2>
        <Link className={linkClass} to="/recruiter/my-applications">Xem tất cả <ArrowRight aria-hidden="true" className="size-3.5" /></Link>
      </div>
      {content}
    </section>
  )
}

function RecentNotifications({ resource }) {
  let content
  if (resource.loading) content = <ListSkeleton label="Đang tải thông báo gần đây" rows={3} />
  else if (resource.error) content = <ErrorState className="px-0 py-6" error={resource.error} onRetry={resource.reload} />
  else if (!resource.data.notifications.length) content = <p className="py-5 text-sm text-muted-foreground">Chưa có thông báo.</p>
  else content = (
    <ul className="divide-y">
      {resource.data.notifications.map((notification) => (
        <li className="flex items-start gap-2 py-4" key={notification.id ?? notification._id}>
          <Bell aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm break-words">{notification.content}</p>
            <time className="mt-1 block text-xs text-muted-foreground" dateTime={notification.createdAt}>{formatMoment(notification.createdAt)}</time>
          </div>
        </li>
      ))}
    </ul>
  )
  return (
    <section aria-labelledby="home-notifications-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold" id="home-notifications-heading">Thông báo gần đây</h2>
        <Link className={linkClass} to="/recruiter/notifications">Xem tất cả <ArrowRight aria-hidden="true" className="size-3.5" /></Link>
      </div>
      {content}
    </section>
  )
}

function RecruiterHome() {
  const membership = useAppSelector(selectMembership)
  const { search, setFilters, setPage, reset } = useListSearch(SEARCH_SPEC)
  const q = useDebouncedValue(search.q)
  // Both scopes on Home are published Jobs; effective expiry is displayed, never filtered after paging.
  const query = useMemo(() => ({ ...toListQuery({ ...search, q }, 6), status: JOB_STATUS.PUBLISHED }), [search, q])
  const jobs = useResource(listRecruiterJobsApi, query)
  const applications = useResource(listMyApplicationsApi, RECENT_APPLICATIONS_QUERY)
  const notifications = useResource(listOwnNotificationsApi, RECENT_NOTIFICATIONS_QUERY)
  const provinces = useResource(listProvincesApi)
  const experienceLevels = useResource(listExperienceLevelsApi)
  const items = jobs.data?.jobs ?? []
  const districts = useDistrictNames(items.map((job) => job.location?.provinceCode).filter(Boolean))
  const reloadJobs = jobs.reload
  const reloadApplications = applications.reload
  const reloadNotifications = notifications.reload

  useEffect(() => {
    const offNotification = subscribeRealtimeEvent(REALTIME_EVENT.NOTIFICATION, () => {
      reloadApplications()
      reloadNotifications()
    })
    const offConnect = subscribeRealtimeEvent(SOCKET_LIFECYCLE_EVENT.CONNECT, () => {
      reloadJobs()
      reloadApplications()
      reloadNotifications()
    })
    return () => { offNotification(); offConnect() }
  }, [reloadJobs, reloadApplications, reloadNotifications])

  let jobList
  if (jobs.loading) jobList = <ListSkeleton label="Đang tải Job đã công bố" rows={3} />
  else if (jobs.error) jobList = <ErrorState error={jobs.error} onRetry={jobs.reload} />
  else if (!items.length) jobList = (
    <StateMessage
      action={(search.q || search.scope !== JOB_LIST_SCOPE.COMPANY_PUBLISHED || search.page > 1) && <Button onClick={reset} type="button" variant="outline">Xóa bộ lọc</Button>}
      description={search.q ? 'Thử tiêu đề khác hoặc thay đổi phạm vi tìm kiếm.' : 'Các Job đã công bố trong phạm vi này sẽ xuất hiện ở đây.'}
      icon={BriefcaseBusiness}
      title="Chưa có Job phù hợp"
    />
  )
  else jobList = (
    <>
      <ul aria-label="Job đã công bố" className="space-y-4">
        {items.map((job) => {
          const location = job.location
          const locationLabel = [districts[location?.provinceCode]?.[location?.districtCode], provinces.data?.provinces?.find((province) => province.code === location?.provinceCode)?.name].filter(Boolean).join(', ')
          return <HomeJobCard experience={experienceLevels.data?.experienceLevels?.find((level) => level.id === job.experienceLevelId)?.name} job={job} key={job.id} location={locationLabel} membershipId={membership?.id} />
        })}
      </ul>
      <Pager onPageChange={setPage} pagination={jobs.data.pagination} unit="Job" />
    </>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Một ngày tuyển dụng hiệu quả</h1>
        <p className="mt-1 text-sm text-muted-foreground">Theo dõi công việc của bạn và khám phá vị trí trong công ty.</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-y py-4">
        <p aria-live="polite" className="text-sm text-muted-foreground">
          <span className="mr-2 text-xl font-semibold text-foreground tabular-nums">{applications.error || applications.loading ? '—' : applications.data.currentWorkloadCount}</span>{' '}
          hồ sơ bạn đang xử lý
        </p>
        <p className="text-xs text-muted-foreground">Gồm cả hồ sơ trong Job đã đóng hoặc hết hạn</p>
        <Link className={`${linkClass} sm:ml-auto`} to="/recruiter/my-applications">Xem hồ sơ của tôi <ArrowRight aria-hidden="true" className="size-4" /></Link>
      </div>
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="home-jobs-heading" className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold" id="home-jobs-heading">Job đã công bố của công ty</h2>
            {!jobs.loading && !jobs.error && <span aria-live="polite" className="text-sm text-muted-foreground">{jobs.data.pagination.total} Job</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <SearchInput label="Tìm theo tiêu đề Job" onChange={(value) => setFilters({ q: value })} value={search.q} />
            <SelectDropdown ariaLabel="Phạm vi Job" className="w-full sm:w-40" onChange={(scope) => setFilters({ scope })} options={SCOPE_OPTIONS} value={search.scope} />
            <SelectDropdown ariaLabel="Sắp xếp Job" className="w-full sm:w-44" onChange={(sort) => setFilters({ sort })} options={SORT_OPTIONS} value={search.sort} />
          </div>
          {jobList}
        </section>
        <aside aria-label="Công việc gần đây" className="grid min-w-0 gap-8 md:grid-cols-2 xl:grid-cols-1">
          <RecentApplications resource={applications} />
          <RecentNotifications resource={notifications} />
        </aside>
      </div>
    </div>
  )
}

export default RecruiterHome
