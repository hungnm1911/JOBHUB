import { ChevronDown, Network, Search, X } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import HierarchyPicker from '@/features/job-discovery/components/HierarchyPicker'
import LocationHierarchyPicker from '@/features/job-discovery/components/LocationHierarchyPicker'
import useFieldPositions from '@/features/job-discovery/hooks/useFieldPositions'
import { EMPLOYMENT_TYPE_LABEL, WORK_MODE_LABEL } from '@/features/job-discovery/utils'
import { cn } from '@/lib/utils'
import { EMPLOYMENT_TYPE, WORK_MODE } from '@/utils/constant'

const SEARCHABLE_FROM = 5

const CATEGORY_TEXT = Object.freeze({
  parentSearch: 'Nhập lĩnh vực',
  childSearch: 'Nhập vị trí',
  chooseParent: 'Chọn một lĩnh vực để xem vị trí.',
  unknownParent: 'Lĩnh vực đã chọn',
})

// Both hierarchy pickers open to the right of the narrow filter column.
const PICKER_PANEL_CLASS = 'right-auto left-0'

const normalize = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function usePositionOptions(fieldId) {
  const { positions, loading, error, reload } = useFieldPositions(fieldId)
  return { items: positions, loading, error, reload }
}

function FilterGroup({ title, count, defaultOpen = false, children }) {
  const contentId = useId()
  const [open, setOpen] = useState(defaultOpen || count > 0)

  return (
    <section className="border-t px-4">
      <h3>
        <button
          aria-controls={contentId}
          aria-expanded={open}
          className="flex min-h-12 w-full items-center gap-2 rounded-sm text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <span className="flex-1">{title}</span>
          {count > 0 && (
            <span className="rounded-md bg-primary/10 px-1.5 text-xs leading-5 font-semibold">{count}</span>
          )}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-4 text-muted-foreground transition-transform motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
        </button>
      </h3>
      {open && (
        <div className="pb-4" id={contentId}>
          {children}
        </div>
      )}
    </section>
  )
}

// Multi-select with its own search box once the list is long enough to need one.
function CheckList({ label, options, values, onChange }) {
  const [query, setQuery] = useState('')
  const needle = normalize(query.trim())
  const visible = needle ? options.filter((option) => normalize(option.label).includes(needle)) : options
  const toggle = (value) =>
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])

  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      {options.length > SEARCHABLE_FROM && (
        <label className="mb-2 flex h-9 items-center gap-2 rounded-md border bg-card px-2.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
          <Search aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="sr-only">Tìm trong {label}</span>
          <input
            className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm..."
            type="search"
            value={query}
          />
        </label>
      )}
      <ul className="max-h-56 overflow-y-auto">
        {visible.map((option) => (
          <li key={option.value}>
            <label className="flex min-h-8 cursor-pointer items-center gap-2.5 text-sm pointer-coarse:min-h-11">
              <input
                checked={values.includes(option.value)}
                className="size-4 shrink-0 accent-primary"
                onChange={() => toggle(option.value)}
                type="checkbox"
              />
              {option.label}
            </label>
          </li>
        ))}
      </ul>
      {visible.length === 0 && <p className="text-sm text-muted-foreground">Không có kết quả phù hợp.</p>}
    </fieldset>
  )
}

// There is no skill catalog: each entry is the Recruiter's own text.
function SkillInput({ values, onChange }) {
  const [draft, setDraft] = useState('')

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const skill = draft.trim()
        if (skill && !values.includes(skill)) onChange([...values, skill])
        setDraft('')
      }}
    >
      <label>
        <span className="sr-only">Thêm kỹ năng</span>
        <input
          className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          maxLength={100}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Nhập rồi nhấn Enter"
          value={draft}
        />
      </label>
      {values.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {values.map((skill) => (
            <li key={skill}>
              <button
                aria-label={`Bỏ kỹ năng ${skill}`}
                className="inline-flex min-h-8 items-center gap-1 rounded-md bg-secondary px-2 text-sm outline-none hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onChange(values.filter((value) => value !== skill))}
                type="button"
              >
                {skill}
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}

function CandidateFilters({ id, className, search, catalogs, experienceOptions, onApply, onReset, canReset }) {
  return (
    <aside aria-label="Bộ lọc CV" className={cn('rounded-lg border bg-card', className)} id={id}>
      {/* Fixed height so the reset action never shifts the groups. */}
      <div className="flex min-h-12 items-center justify-between gap-2 px-4">
        <h2 className="text-base font-semibold">Bộ lọc</h2>
        {canReset && (
          <Button className="-mr-2" onClick={onReset} size="sm" type="button" variant="ghost">
            Đặt lại
          </Button>
        )}
      </div>

      <FilterGroup count={search.categories.length} defaultOpen title="Danh mục công việc">
        <div className="rounded-md border">
          <HierarchyPicker
            allLabel="Tất cả danh mục"
            icon={Network}
            label="Lĩnh vực / vị trí"
            onApply={(categories) => onApply({ categories })}
            panelClassName={PICKER_PANEL_CLASS}
            parents={catalogs.fields}
            parentsLoading={catalogs.loading}
            text={CATEGORY_TEXT}
            useChildren={usePositionOptions}
            value={search.categories}
          />
        </div>
      </FilterGroup>

      <FilterGroup count={search.experienceLevelIds.length} defaultOpen title="Cấp độ kinh nghiệm">
        <CheckList
          label="Cấp độ kinh nghiệm"
          onChange={(experienceLevelIds) => onApply({ experienceLevelIds })}
          options={experienceOptions}
          values={search.experienceLevelIds}
        />
      </FilterGroup>

      <FilterGroup count={search.skillTags.length} defaultOpen title="Kỹ năng">
        <SkillInput onChange={(skillTags) => onApply({ skillTags })} values={search.skillTags} />
      </FilterGroup>

      <FilterGroup count={search.locations.length} defaultOpen title="Địa điểm mong muốn">
        <div className="rounded-md border">
          <LocationHierarchyPicker
            locations={search.locations}
            onApply={(locations) => onApply({ locations })}
            panelClassName={PICKER_PANEL_CLASS}
            provinces={catalogs.provinces}
          />
        </div>
      </FilterGroup>

      <FilterGroup count={search.employmentTypes.length} title="Loại hình việc làm">
        <CheckList
          label="Loại hình việc làm"
          onChange={(employmentTypes) => onApply({ employmentTypes })}
          options={Object.values(EMPLOYMENT_TYPE).map((value) => ({
            value,
            label: EMPLOYMENT_TYPE_LABEL[value] ?? value,
          }))}
          values={search.employmentTypes}
        />
      </FilterGroup>

      <FilterGroup count={search.workModes.length} title="Hình thức làm việc">
        <CheckList
          label="Hình thức làm việc"
          onChange={(workModes) => onApply({ workModes })}
          options={Object.values(WORK_MODE).map((value) => ({
            value,
            label: WORK_MODE_LABEL[value] ?? value,
          }))}
          values={search.workModes}
        />
      </FilterGroup>
    </aside>
  )
}

export default CandidateFilters
