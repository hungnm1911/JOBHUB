import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import DiscoveryJobsSection from '@/features/job-discovery/components/DiscoveryJobsSection'
import FieldCategoryPanel from '@/features/job-discovery/components/FieldCategoryPanel'
import FieldPositionPanel from '@/features/job-discovery/components/FieldPositionPanel'
import HomeHero from '@/features/job-discovery/components/HomeHero'
import JobSearchBar from '@/features/job-discovery/components/JobSearchBar'
import PlatformShowcaseCarousel from '@/features/job-discovery/components/PlatformShowcaseCarousel'
import useDiscoveryCatalogs from '@/features/job-discovery/hooks/useDiscoveryCatalogs'
import { parseJobSearch, toJobSearchParams } from '@/features/job-discovery/search-params'
import useSessionViewer from '@/features/authentication/hooks/useSessionViewer'
import DiscoveryJobActions from '@/pages/discovery-job-actions'

const JOBS_SECTION_ID = 'jobs'
const EMPTY_SEARCH = parseJobSearch(new URLSearchParams())

function readPage(value) {
  const page = Number(value)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

function scrollToJobs() {
  document.getElementById(JOBS_SECTION_ID)?.scrollIntoView({ behavior: 'smooth' })
}

function HomePage() {
  const { hash, key: locationKey } = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [previewFieldId, setPreviewFieldId] = useState(null)
  const viewer = useSessionViewer()

  useEffect(() => {
    if (hash === `#${JOBS_SECTION_ID}`) {
      scrollToJobs()
    }
  }, [hash, locationKey])
  const { fields, fieldsLoading, fieldsError, provinces, provinceNameByCode } =
    useDiscoveryCatalogs()

  const page = readPage(searchParams.get('page'))

  const previewField = fields.find((field) => field.id === previewFieldId) ?? null

  const navigateToJobs = (changes) => {
    const search = toJobSearchParams({ ...EMPTY_SEARCH, ...changes }).toString()
    navigate({ pathname: '/jobs', search })
  }

  return (
    <div className="w-full">
      <HomeHero
        fieldCount={fieldsLoading || fieldsError ? null : fields.length}
        provinceNameByCode={provinceNameByCode}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <JobSearchBar
          keyword=""
          locations={[]}
          onLocationChange={(selection) => navigateToJobs({ locations: selection })}
          onSearch={(keyword) => navigateToJobs({ keyword })}
          provinces={provinces}
        />

        <div
          className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]"
          onMouseLeave={() => setPreviewFieldId(null)}
        >
          <FieldCategoryPanel
            error={fieldsError}
            fields={fields}
            loading={fieldsLoading}
            onPreview={setPreviewFieldId}
            onSelect={(id) => navigateToJobs({ categories: [{ id, childIds: [] }] })}
            previewFieldId={previewFieldId}
          />
          <div className="relative">
            <PlatformShowcaseCarousel />
            {previewField && (
              <div className="absolute inset-0 z-10">
                <FieldPositionPanel
                  field={previewField}
                  key={previewField.id}
                  onClose={() => setPreviewFieldId(null)}
                  onSelect={(nextFieldId, nextPositionId) => {
                    navigateToJobs({ categories: [{ id: nextFieldId, childIds: nextPositionId ? [nextPositionId] : [] }] })
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 pt-6 pb-16">
        <DiscoveryJobsSection
          id={JOBS_SECTION_ID}
          onPageChange={(nextPage) => {
            setSearchParams(nextPage > 1 ? { page: String(nextPage) } : {})
            scrollToJobs()
          }}
          page={page}
          provinceNameByCode={provinceNameByCode}
          renderJobAction={(job) => <DiscoveryJobActions job={job} revealApplyOnHover viewer={viewer} />}
        />
      </div>
    </div>
  )
}

export default HomePage
