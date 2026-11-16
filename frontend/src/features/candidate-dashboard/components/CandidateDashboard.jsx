import { CircleX, LoaderCircle, RotateCw } from 'lucide-react'
import { useState } from 'react'

import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import { selectAuthenticatedUser } from '@/features/authentication/slice'
import { useAppSelector } from '@/store/hooks'

import useCandidateDashboardData from '../hooks/useCandidateDashboardData'
import useCandidateRecommendations from '../hooks/useCandidateRecommendations'
import AiAssistantBanner from './AiAssistantBanner'
import DashboardStatCards from './DashboardStatCards'
import MarketInsightsCard from './MarketInsightsCard'
import NotificationsPanel from './NotificationsPanel'
import ProfileCompletionCard from './ProfileCompletionCard'
import RecentApplicationsList from './RecentApplicationsList'
import RecommendedJobsSection from './RecommendedJobsSection'
import WelcomeSection from './WelcomeSection'

function CandidateDashboard() {
  const user = useAppSelector(selectAuthenticatedUser)
  const { loading, data, error, reload } = useCandidateDashboardData()
  const recommendations = useCandidateRecommendations()
  const [jobSource, setJobSource] = useState('discovery')

  const hasDefaultCv = Boolean(data.cvs.some((cv) => cv.isDefault))

  const handleExploreAi = async () => {
    setJobSource('ai')
    await recommendations.load()
  }

  if (loading) {
    return (
      <CenteredState
        icon={LoaderCircle}
        spinning
        title="Đang tải bảng điều khiển…"
        tone="bg-primary/10 text-primary"
      />
    )
  }

  if (error) {
    return (
      <CenteredState
        action={
          <Button onClick={reload} variant="outline">
            <RotateCw aria-hidden="true" className="size-4" />
            Thử lại
          </Button>
        }
        description={error.message || 'Không tải được dữ liệu dashboard.'}
        icon={CircleX}
        title="Không tải được tổng quan"
        tone="bg-secondary text-muted-foreground"
      />
    )
  }

  return (
    <div className="space-y-5">
      <WelcomeSection
        applicationCount={data.applications.length}
        completionPercent={data.completion.percent}
        fullName={data.profile?.fullName ?? user?.fullName}
      />

      <DashboardStatCards
        applications={data.applications}
        cvs={data.cvs}
        invitations={data.invitations}
        savedJobs={data.savedJobs}
      />

      <AiAssistantBanner
        hasDefaultCv={hasDefaultCv}
        loading={recommendations.status === 'loading'}
        onExplore={handleExploreAi}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <RecentApplicationsList applications={data.applications} />
          <RecommendedJobsSection
            error={
              jobSource === 'ai' && recommendations.status === 'error'
                ? recommendations.error
                : jobSource !== 'ai'
                  ? data.partialErrors?.discoveryJobs
                  : null
            }
            jobs={data.discoveryJobs}
            loading={jobSource === 'ai' && recommendations.status === 'loading'}
            recommendations={recommendations.recommendations}
            source={jobSource === 'ai' && recommendations.status === 'success' ? 'ai' : 'discovery'}
          />
        </div>

        <aside className="space-y-5">
          <ProfileCompletionCard completion={data.completion} />
          <NotificationsPanel
            notifications={data.notifications}
            unreadCount={data.unreadCount}
          />
          <MarketInsightsCard />
        </aside>
      </div>
    </div>
  )
}

export default CandidateDashboard
