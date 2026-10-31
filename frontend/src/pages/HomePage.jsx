import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

import DiscoveryJobsSection from '@/features/job-discovery/components/DiscoveryJobsSection'
import FieldCategoryPanel from '@/features/job-discovery/components/FieldCategoryPanel'
import FieldPositionPanel from '@/features/job-discovery/components/FieldPositionPanel'
import HomeHero from '@/features/job-discovery/components/HomeHero'
import JobSearchBar from '@/features/job-discovery/components/JobSearchBar'
import PlatformShowcaseCarousel from '@/features/job-discovery/components/PlatformShowcaseCarousel'
import useDiscoveryCatalogs from '@/features/job-discovery/hooks/useDiscoveryCatalogs'
import useFieldPositions from '@/features/job-discovery/hooks/useFieldPositions'
import useSessionViewer from '@/features/authentication/hooks/useSessionViewer'
import DiscoveryJobActions from '@/pages/discovery-job-actions'

const JOBS_SECTION_ID = 'jobs'

function readPage(value) {
  const page = Number(value)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

function scrollToJobs() {
  document.getElementById(JOBS_SECTION_ID)?.scrollIntoView({ behavior: 'smooth' })
}

function HomePage() {
  const { hash, key: locationKey } = useLocation()
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

  const keyword = searchParams.get('q') ?? ''
  const provinceCode = searchParams.get('location') ?? ''
  const fieldId = searchParams.get('field') ?? ''
  const positionId = fieldId ? (searchParams.get('position') ?? '') : ''
  const page = readPage(searchParams.get('page'))

  const { positions: selectedFieldPositions } = useFieldPositions(positionId ? fieldId : null)
  const previewField = fields.find((field) => field.id === previewFieldId) ?? null

  const activeFilterLabels = [
    keyword && `Từ khóa: “${keyword}”`,
    provinceCode && (provinceNameByCode.get(provinceCode) ?? 'Địa điểm đã chọn'),
    fieldId && (fields.find((field) => field.id === fieldId)?.name ?? 'Ngành nghề đã chọn'),
    positionId &&
      (selectedFieldPositions.find((position) => position.id === positionId)?.name ??
        'Vị trí đã chọn'),
  ].filter(Boolean)

  const updateFilters = (changes, { scroll = true } = {}) => {
    const next = {
      q: keyword,
      location: provinceCode,
      field: fieldId,
      position: positionId,
      page: '',
      ...changes,
    }
    const params = new URLSearchParams()

    if (!next.field) {
      next.position = ''
    }

    for (const [key, value] of Object.entries(next)) {
      if (value && !(key === 'page' && Number(value) === 1)) {
        params.set(key, String(value))
      }
    }

    setSearchParams(params, { preventScrollReset: true })

    if (scroll) {
      scrollToJobs()
    }
  }

  return (
    <div className="w-full">
      <HomeHero
        fieldCount={fieldsLoading || fieldsError ? null : fields.length}
        provinceNameByCode={provinceNameByCode}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <JobSearchBar
          keyword={keyword}
          onSearch={(values) => updateFilters({ q: values.keyword, location: values.provinceCode })}
          provinceCode={provinceCode}
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
            onSelect={(id) => updateFilters({ field: id ?? '', position: '' }, { scroll: false })}
            previewFieldId={previewFieldId}
            selectedFieldId={fieldId}
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
                    setPreviewFieldId(null)
                    updateFilters({ field: nextFieldId, position: nextPositionId ?? '' })
                  }}
                  selectedFieldId={fieldId}
                  selectedPositionId={positionId}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 pt-6 pb-16">
        <DiscoveryJobsSection
          activeFilterLabels={activeFilterLabels}
          fieldId={fieldId}
          id={JOBS_SECTION_ID}
          keyword={keyword}
          onClearFilters={() =>
            updateFilters({ q: '', location: '', field: '', position: '' }, { scroll: false })
          }
          onPageChange={(nextPage) => updateFilters({ page: nextPage })}
          page={page}
          positionId={positionId}
          provinceCode={provinceCode}
          provinceNameByCode={provinceNameByCode}
          renderJobAction={(job) => <DiscoveryJobActions job={job} revealApplyOnHover viewer={viewer} />}
        />
      </div>
    </div>
  )
}

export default HomePage
