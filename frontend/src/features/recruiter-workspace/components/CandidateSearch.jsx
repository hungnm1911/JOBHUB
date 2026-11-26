import { ChevronDown, Lock, Search, SearchX, SlidersHorizontal, UserSearch, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { listSearchCandidateCvsApi } from '@/apis/recruiter-sourcing.api'
import { ErrorState, Pager, StateMessage } from '@/components/common/ListStates'
import { Button } from '@/components/ui/button'
import { SelectDropdown } from '@/components/ui/select-dropdown'
import useCvCatalogOptions from '@/features/candidate-cvs/hooks/useCvCatalogOptions'
import {
  EMPLOYMENT_TYPE_LABEL,
  EXPERIENCE_LEVEL_LABEL,
  WORK_MODE_LABEL,
} from '@/features/job-discovery/utils'
import { cn } from '@/lib/utils'

import { toCvSummary } from '../candidate-cv-summary'
import {
  SORT,
  readCandidateSearch,
  toCandidateSearchParams,
  toCandidateSearchQuery,
} from '../candidate-search'
import useDistrictNames from '../hooks/useDistrictNames'
import usePositionsByField from '../hooks/usePositionsByField'
import useResource from '../hooks/useResource'
import CandidateCvCard from './CandidateCvCard'
import CandidateFilters from './CandidateFilters'
import InviteDialog from './InviteDialog'

const SORT_OPTIONS = [
  { value: SORT.NEWEST, label: 'Mới cập nhật' },
  { value: SORT.OLDEST, label: 'Cập nhật cũ nhất' },
]

const loadCvs = (query) => listSearchCandidateCvsApi(new URLSearchParams(query))

function KeywordBar({ keyword, onSearch }) {
  return (
    <form
      aria-label="Tìm CV theo kỹ năng"
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        onSearch(new FormData(event.currentTarget).get('keyword').trim())
      }}
      role="search"
    >
      <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border bg-card px-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
        <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Kỹ năng cần tìm</span>
        <input
          className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          defaultValue={keyword}
          maxLength={200}
          name="keyword"
          placeholder="Nhập kỹ năng cần tìm..."
          type="search"
        />
      </label>
      <Button type="submit">Tìm kiếm</Button>
    </form>
  )
}

// One removable chip per active condition.
function toActiveFilters(search, names) {
  const without = (field, value) => ({ [field]: search[field].filter((item) => item !== value) })
  const branches = (field, nameOf) =>
    search[field].map((branch) => ({
      key: `${field}-${branch.id}`,
      label: `${nameOf(branch.id) ?? 'Đã chọn'}${branch.childIds.length ? ` (${branch.childIds.length})` : ''}`,
      patch: { [field]: search[field].filter((item) => item.id !== branch.id) },
    }))
  const values = (field, nameOf) =>
    search[field].map((value) => ({
      key: `${field}-${value}`,
      label: nameOf(value) ?? value,
      patch: without(field, value),
    }))

  return [
    ...(search.keyword
      ? [{ key: 'keyword', label: `Từ khóa: ${search.keyword}`, patch: { keyword: '' } }]
      : []),
    ...branches('categories', (id) => names.categories.get(id)),
    ...values('experienceLevelIds', (id) => names.experience.get(id)),
    ...values('skillTags', (skill) => skill),
    ...branches('locations', (code) => names.provinces.get(code)),
    ...values('employmentTypes', (value) => EMPLOYMENT_TYPE_LABEL[value]),
    ...values('workModes', (value) => WORK_MODE_LABEL[value]),
  ]
}

function ActiveFilters({ filters, onRemove, onReset }) {
  if (!filters.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul aria-label="Điều kiện đang lọc" className="contents">
        {filters.map((filter) => (
          <li key={filter.key}>
            <button
              aria-label={`Bỏ điều kiện ${filter.label}`}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 pr-2 pl-2.5 text-sm outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onRemove(filter.patch)}
              type="button"
            >
              {filter.label}
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <Button onClick={onReset} size="sm" type="button" variant="ghost">
        Xóa tất cả
      </Button>
    </div>
  )
}

function ResultSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Đang tìm CV" className="space-y-2" role="status">
      {Array.from({ length: 4 }, (_, index) => (
        <li className="flex gap-4 rounded-lg border bg-card p-4" key={index}>
          <div className="size-12 animate-pulse rounded-md bg-secondary motion-reduce:animate-none" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/5 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
            <div className="h-8 w-4/5 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function CandidateSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = useMemo(() => readCandidateSearch(searchParams), [searchParams])
  const { data, loading, error, reload } = useResource(loadCvs, toCandidateSearchQuery(search))
  const catalogs = useCvCatalogOptions()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [inviting, setInviting] = useState(null)
  const cvs = data?.cvs ?? []
  const fieldIds = useMemo(() => catalogs.fields.map((field) => field.id), [catalogs.fields])
  const { positionsByField } = usePositionsByField(fieldIds)
  const districts = useDistrictNames(
    cvs.flatMap((cv) => cv.preferredLocations.map((location) => location.provinceCode)),
  )
  const experienceOptions = catalogs.experienceLevels.map((level) => ({
    value: level.id,
    label: EXPERIENCE_LEVEL_LABEL[level.code] ?? level.name,
  }))
  const names = {
    districts,
    provinces: new Map(catalogs.provinces.map((province) => [province.code, province.name])),
    categories: new Map(
      [...catalogs.fields, ...Object.values(positionsByField).flat()].map((item) => [item.id, item.name]),
    ),
    experience: new Map(experienceOptions.map((option) => [option.value, option.label])),
  }
  const activeFilters = toActiveFilters(search, names)
  const filterCount = activeFilters.length - (search.keyword ? 1 : 0)

  // Any filter change returns to page 1.
  const apply = useCallback(
    (patch) => setSearchParams(toCandidateSearchParams({ ...search, page: 1, ...patch })),
    [search, setSearchParams],
  )
  const reset = () => setSearchParams({})

  const title = <h1 className="text-2xl font-bold tracking-tight">Tìm kiếm ứng viên</h1>

  if (error?.status === 403) {
    return (
      <div className="space-y-4">
        {title}
        <div className="rounded-lg border bg-card">
          <StateMessage
            description="Bạn cần đang là người phụ trách chính hoặc người hỗ trợ của ít nhất một Job để tìm ứng viên."
            icon={Lock}
            title="Chưa dùng được Tìm CV"
          />
        </div>
      </div>
    )
  }

  let body
  if (loading) body = <ResultSkeleton />
  else if (error || cvs.length === 0) {
    body = (
      <div className="rounded-lg border bg-card">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <StateMessage
            action={
              <Button onClick={reset} size="sm" type="button" variant="outline">
                Xóa bộ lọc
              </Button>
            }
            description="Thử từ khóa kỹ năng khác hoặc bớt điều kiện lọc."
            icon={searchParams.size ? SearchX : UserSearch}
            title="Không có CV phù hợp"
          />
        )}
      </div>
    )
  } else {
    const from = searchParams.size ? `?${searchParams}` : ''
    body = (
      <ul aria-label="Kết quả tìm CV" className="space-y-2">
        {cvs.map((cv) => (
          <CandidateCvCard cv={toCvSummary(cv, names)} from={from} key={cv.cvId} onInvite={setInviting} />
        ))}
      </ul>
    )
  }

  return (
    <div className="space-y-4">
      {title}
      {/* Keyed by the URL keyword so removing its chip also clears the field. */}
      <KeywordBar key={search.keyword} keyword={search.keyword} onSearch={(keyword) => apply({ keyword })} />
      <div className="grid gap-4 lg:grid-cols-[16.25rem_minmax(0,1fr)] lg:items-start">
        <Button
          aria-controls="cv-filters"
          aria-expanded={filtersOpen}
          className="justify-between lg:hidden"
          onClick={() => setFiltersOpen((open) => !open)}
          type="button"
          variant="outline"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            Bộ lọc{filterCount > 0 ? ` (${filterCount})` : ''}
          </span>
          <ChevronDown aria-hidden="true" className={cn('size-4', filtersOpen && 'rotate-180')} />
        </Button>
        <CandidateFilters
          canReset={activeFilters.length > 0}
          catalogs={catalogs}
          className={cn('lg:block', !filtersOpen && 'hidden')}
          experienceOptions={experienceOptions}
          id="cv-filters"
          onApply={apply}
          onReset={reset}
          search={search}
        />
        <div className="min-w-0 space-y-2">
          <ActiveFilters filters={activeFilters} onRemove={apply} onReset={reset} />
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground" role="status">
              {data?.pagination ? `${data.pagination.total} CV phù hợp` : ''}
            </p>
            <SelectDropdown
              ariaLabel="Sắp xếp"
              className="w-44"
              onChange={(sort) => apply({ sort })}
              options={SORT_OPTIONS}
              value={search.sort}
            />
          </div>
          {body}
          {data?.pagination?.totalPages > 1 && (
            <div className="rounded-lg border bg-card [&>div]:border-t-0">
              <Pager onPageChange={(page) => apply({ page })} pagination={data.pagination} unit="CV" />
            </div>
          )}
        </div>
      </div>
      {inviting && <InviteDialog cv={inviting} onClose={() => setInviting(null)} />}
    </div>
  )
}

export default CandidateSearch
