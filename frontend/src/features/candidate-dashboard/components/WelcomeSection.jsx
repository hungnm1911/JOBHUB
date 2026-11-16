import { FilePlus2, Search, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import JobSearchBar from '@/features/job-discovery/components/JobSearchBar'
import useDiscoveryCatalogs from '@/features/job-discovery/hooks/useDiscoveryCatalogs'
import { parseJobSearch, toJobSearchParams } from '@/features/job-discovery/search-params'

const EMPTY_SEARCH = parseJobSearch(new URLSearchParams())

function WelcomeSection({ fullName, applicationCount, completionPercent }) {
  const navigate = useNavigate()
  const { provinces } = useDiscoveryCatalogs()
  const [locations, setLocations] = useState([])
  const greetingName = fullName?.trim() || 'bạn'

  const navigateToJobs = (changes) => {
    const search = toJobSearchParams({ ...EMPTY_SEARCH, ...changes }).toString()
    navigate({ pathname: '/jobs', search })
  }

  return (
    <section className="rounded-2xl border bg-primary/5 px-5 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Xin chào, {greetingName}!
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {applicationCount > 0
              ? `Bạn đang theo dõi ${applicationCount} đơn ứng tuyển. Hồ sơ của bạn hoàn thiện khoảng ${completionPercent}%.`
              : `Hồ sơ của bạn hoàn thiện khoảng ${completionPercent}%. Bắt đầu bằng cách tạo CV hoặc tìm việc phù hợp.`}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/candidate/cvs/create">
            <FilePlus2 aria-hidden="true" className="size-4" />
            Tạo CV mới
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/jobs">
            <Search aria-hidden="true" className="size-4" />
            Tìm việc làm
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/candidate/ai-jobs">
            <Sparkles aria-hidden="true" className="size-4" />
            Khám phá việc làm AI
          </Link>
        </Button>
      </div>

      <div className="mt-5">
        <JobSearchBar
          keyword=""
          locations={locations}
          onLocationChange={(selection) => {
            setLocations(selection)
            navigateToJobs({ locations: selection })
          }}
          onSearch={(keyword) => navigateToJobs({ keyword, locations })}
          provinces={provinces}
        />
      </div>
    </section>
  )
}

export default WelcomeSection
