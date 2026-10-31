import { SlidersHorizontal, X } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { EMPLOYMENT_TYPE, WORK_MODE } from '@/utils/constant'

import { FILTERABLE_SALARY_PERIODS } from '../search-params'
import {
  EMPLOYMENT_TYPE_LABEL,
  EXPERIENCE_LEVEL_LABEL,
  SALARY_PERIOD_SUFFIX,
  WORK_MODE_LABEL,
} from '../utils'

const COLLAPSED_OPTION_COUNT = 4
const amountFormatter = new Intl.NumberFormat('vi-VN')

const WORK_MODE_OPTIONS = Object.values(WORK_MODE).map((value) => ({
  value,
  label: WORK_MODE_LABEL[value],
}))
const EMPLOYMENT_TYPE_OPTIONS = Object.values(EMPLOYMENT_TYPE).map((value) => ({
  value,
  label: EMPLOYMENT_TYPE_LABEL[value],
}))

function toggleValue(values, value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function formatAmountInput(value) {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  return digits ? amountFormatter.format(Number(digits)) : ''
}

function parseAmountInput(value) {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : null
}

function toSalaryDraft(salary) {
  return {
    min: salary ? amountFormatter.format(salary.min) : '',
    max: salary ? amountFormatter.format(salary.max) : '',
    period: salary?.period ?? 'MONTH',
  }
}

function CheckboxGroup({ title, options, values, onToggle, loading = false }) {
  const [expanded, setExpanded] = useState(false)
  const collapsible = options.length > COLLAPSED_OPTION_COUNT + 1
  const visibleOptions =
    collapsible && !expanded
      ? options.filter(
          (option, index) => index < COLLAPSED_OPTION_COUNT || values.includes(option.value),
        )
      : options

  return (
    <fieldset className="border-t pt-4">
      <legend className="float-left w-full text-sm font-semibold">{title}</legend>
      {loading ? (
        <p className="clear-both pt-3 text-sm text-muted-foreground">Đang tải...</p>
      ) : (
        <ul className="clear-both space-y-0.5 pt-2">
          {visibleOptions.map((option) => (
            <li key={option.value}>
              <label className="flex min-h-9 cursor-pointer items-center gap-3 rounded-md px-1 text-sm hover:bg-secondary/60">
                <input
                  checked={values.includes(option.value)}
                  className="size-4 shrink-0 cursor-pointer accent-primary"
                  onChange={() => onToggle(option.value)}
                  type="checkbox"
                />
                {option.label}
              </label>
            </li>
          ))}
        </ul>
      )}
      {collapsible && (
        <button
          className="mt-1 px-1 text-xs font-semibold text-primary hover:underline"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? 'Thu gọn' : `Xem thêm ${options.length - visibleOptions.length} lựa chọn`}
        </button>
      )}
    </fieldset>
  )
}

function SalaryFilter({ salary, onApply }) {
  const [draft, setDraft] = useState(() => toSalaryDraft(salary))
  const salaryKey = JSON.stringify(salary)
  const [syncedSalaryKey, setSyncedSalaryKey] = useState(salaryKey)
  const [error, setError] = useState(null)
  const errorId = useId()

  if (syncedSalaryKey !== salaryKey) {
    setSyncedSalaryKey(salaryKey)
    setDraft(toSalaryDraft(salary))
    setError(null)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const min = parseAmountInput(draft.min)
    const max = parseAmountInput(draft.max)

    if (min == null || max == null) {
      setError('Nhập đủ mức lương tối thiểu và tối đa.')
      return
    }

    if (min > max) {
      setError('Mức lương tối thiểu không được lớn hơn mức tối đa.')
      return
    }

    setError(null)
    onApply({ period: draft.period, min, max })
  }

  return (
    <form className="border-t pt-4" noValidate onSubmit={handleSubmit}>
      <h3 className="text-sm font-semibold">Mức lương</h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          ['min', 'Từ (VND)'],
          ['max', 'Đến (VND)'],
        ].map(([key, label]) => (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground" key={key}>
            {label}
            <input
              aria-describedby={error ? errorId : undefined}
              aria-invalid={Boolean(error)}
              className="h-9 w-full min-w-0 rounded-md border bg-secondary/40 px-2.5 text-sm text-foreground outline-none focus-visible:border-ring aria-invalid:border-destructive"
              inputMode="numeric"
              onChange={(event) =>
                setDraft((current) => ({ ...current, [key]: formatAmountInput(event.target.value) }))
              }
              placeholder="0"
              value={draft[key]}
            />
          </label>
        ))}
      </div>
      <label className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
        Đơn vị
        <select
          className="h-9 rounded-md border bg-secondary/40 px-2 text-sm text-foreground outline-none focus-visible:border-ring"
          onChange={(event) => setDraft((current) => ({ ...current, period: event.target.value }))}
          value={draft.period}
        >
          {FILTERABLE_SALARY_PERIODS.map((period) => (
            <option key={period} value={period}>
              Theo {SALARY_PERIOD_SUFFIX[period]}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="mt-2 text-xs text-destructive" id={errorId} role="alert">
          {error}
        </p>
      )}
      <Button className="mt-3 w-full" size="sm" type="submit">
        Áp dụng mức lương
      </Button>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Chỉ tính các việc làm công bố lương cố định hoặc khoảng lương theo đúng đơn vị đã chọn.
      </p>
    </form>
  )
}

function JobFilterSidebar({
  search,
  experienceLevels,
  experienceLevelsLoading,
  activeFilters,
  onChange,
  onReset,
}) {
  const experienceOptions = experienceLevels.map((level) => ({
    value: level.id,
    label: EXPERIENCE_LEVEL_LABEL[level.code] ?? level.code,
  }))

  return (
    <aside aria-labelledby="job-filter-heading" className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold" id="job-filter-heading">
          <SlidersHorizontal aria-hidden="true" className="size-4 text-primary" />
          Bộ lọc
        </h2>
        <button
          className="text-xs font-semibold text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
          disabled={activeFilters.length === 0}
          onClick={onReset}
          type="button"
        >
          Thiết lập lại
        </button>
      </div>

      {activeFilters.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Đang áp dụng</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {activeFilters.map((filter) => (
              <li key={filter.key}>
                <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 py-1 pr-1 pl-2.5 text-xs font-medium text-primary">
                  <span className="truncate">{filter.label}</span>
                  <button
                    aria-label={`Bỏ lọc ${filter.label}`}
                    className="rounded-full p-0.5 hover:bg-primary/15"
                    onClick={filter.onRemove}
                    type="button"
                  >
                    <X aria-hidden="true" className="size-3" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 space-y-4">
        <CheckboxGroup
          onToggle={(value) => onChange({ workModes: toggleValue(search.workModes, value) })}
          options={WORK_MODE_OPTIONS}
          title="Hình thức làm việc"
          values={search.workModes}
        />
        <CheckboxGroup
          onToggle={(value) => onChange({ employmentTypes: toggleValue(search.employmentTypes, value) })}
          options={EMPLOYMENT_TYPE_OPTIONS}
          title="Loại hợp đồng"
          values={search.employmentTypes}
        />
        <CheckboxGroup
          loading={experienceLevelsLoading}
          onToggle={(value) => onChange({ experienceLevels: toggleValue(search.experienceLevels, value) })}
          options={experienceOptions}
          title="Kinh nghiệm"
          values={search.experienceLevels}
        />
        <SalaryFilter onApply={(salary) => onChange({ salary })} salary={search.salary} />
      </div>
    </aside>
  )
}

export default JobFilterSidebar
