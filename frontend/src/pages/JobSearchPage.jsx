import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import useSessionViewer from '@/features/authentication/hooks/useSessionViewer'
import JobFilterSidebar from '@/features/job-discovery/components/JobFilterSidebar'
import JobSearchResults from '@/features/job-discovery/components/JobSearchResults'
import JobSearchToolbar from '@/features/job-discovery/components/JobSearchToolbar'
import useDiscoveryCatalogs from '@/features/job-discovery/hooks/useDiscoveryCatalogs'
import useExperienceLevels from '@/features/job-discovery/hooks/useExperienceLevels'
import {
  JOB_DISCOVERY_SORT,
  parseJobSearch,
  toJobSearchParams,
} from '@/features/job-discovery/search-params'
import {
  EMPLOYMENT_TYPE_LABEL,
  EXPERIENCE_LEVEL_LABEL,
  formatSalary,
  WORK_MODE_LABEL,
} from '@/features/job-discovery/utils'
import DiscoveryJobActions from '@/pages/discovery-job-actions'
import { SALARY_TYPE } from '@/utils/constant'

const EMPTY_SEARCH = parseJobSearch(new URLSearchParams())

function describeBranch(name, childCount, childUnit) {
  return childCount > 0 ? `${name} (${childCount} ${childUnit})` : name
}

function JobSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = useMemo(() => parseJobSearch(searchParams), [searchParams])
  const { fields, fieldsLoading, provinces, provinceNameByCode } = useDiscoveryCatalogs()
  const { experienceLevels, loading: experienceLevelsLoading } = useExperienceLevels()
  const viewer = useSessionViewer()

  const updateSearch = (changes, { scroll = false } = {}) => {
    const next = { ...search, page: 1, ...changes }

    if (next.sort === JOB_DISCOVERY_SORT.RELEVANCE && !next.keyword) {
      next.sort = null
    }

    setSearchParams(toJobSearchParams(next))

    if (scroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const resetSearch = () => setSearchParams(toJobSearchParams(EMPTY_SEARCH))

  const fieldNameById = new Map(fields.map((field) => [field.id, field.name]))
  const experienceById = new Map(experienceLevels.map((level) => [level.id, level]))

  const activeFilters = [
    search.keyword && {
      key: 'keyword',
      label: `“${search.keyword}”`,
      onRemove: () => updateSearch({ keyword: '' }),
    },
    ...search.categories.map((branch) => ({
      key: `category-${branch.id}`,
      label: describeBranch(fieldNameById.get(branch.id) ?? 'Ngành nghề', branch.childIds.length, 'vị trí'),
      onRemove: () => updateSearch({ categories: search.categories.filter((item) => item.id !== branch.id) }),
    })),
    ...search.locations.map((branch) => ({
      key: `location-${branch.id}`,
      label: describeBranch(provinceNameByCode.get(branch.id) ?? 'Địa điểm', branch.childIds.length, 'quận/huyện'),
      onRemove: () => updateSearch({ locations: search.locations.filter((item) => item.id !== branch.id) }),
    })),
    ...search.workModes.map((value) => ({
      key: `work-mode-${value}`,
      label: WORK_MODE_LABEL[value],
      onRemove: () => updateSearch({ workModes: search.workModes.filter((item) => item !== value) }),
    })),
    ...search.employmentTypes.map((value) => ({
      key: `employment-type-${value}`,
      label: EMPLOYMENT_TYPE_LABEL[value],
      onRemove: () => updateSearch({ employmentTypes: search.employmentTypes.filter((item) => item !== value) }),
    })),
    ...search.experienceLevels.map((id) => ({
      key: `experience-${id}`,
      label: EXPERIENCE_LEVEL_LABEL[experienceById.get(id)?.code] ?? 'Kinh nghiệm',
      onRemove: () => updateSearch({ experienceLevels: search.experienceLevels.filter((item) => item !== id) }),
    })),
    search.salary && {
      key: 'salary',
      label: formatSalary({
        type: SALARY_TYPE.RANGE,
        minAmount: search.salary.min,
        maxAmount: search.salary.max,
        period: search.salary.period,
      }),
      onRemove: () => updateSearch({ salary: null }),
    },
  ].filter(Boolean)

  return (
    <div className="w-full bg-secondary/30">
      <div className="border-b bg-card/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-5">
          <h1 className="sr-only">Tìm kiếm việc làm</h1>
          <JobSearchToolbar
            categories={search.categories}
            fields={fields}
            fieldsLoading={fieldsLoading}
            keyword={search.keyword}
            locations={search.locations}
            onSearch={(changes) => updateSearch(changes)}
            provinces={provinces}
          />
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 md:grid-cols-[15rem_minmax(0,1fr)] md:items-start lg:grid-cols-[17rem_minmax(0,1fr)]">
        <div>
          <JobFilterSidebar
            activeFilters={activeFilters}
            experienceLevels={experienceLevels}
            experienceLevelsLoading={experienceLevelsLoading}
            onChange={(changes) => updateSearch(changes)}
            onReset={resetSearch}
            search={search}
          />
        </div>

        <JobSearchResults
          filtered={activeFilters.length > 0}
          onPageChange={(page) => updateSearch({ page }, { scroll: true })}
          onReset={resetSearch}
          onSortChange={(sort) => updateSearch({ sort })}
          provinceNameByCode={provinceNameByCode}
          renderJobAction={(job) => <DiscoveryJobActions job={job} revealApplyOnHover viewer={viewer} />}
          search={search}
        />
      </div>
    </div>
  )
}

export default JobSearchPage
