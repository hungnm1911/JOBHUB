import { CircleAlert, CircleCheck, Circle, LoaderCircle, Plus, Send, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { listDistrictLevelUnitsApi } from '@/apis/location.api'
import RichTextEditor from '@/components/common/RichTextEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'
import { SelectDropdown } from '@/components/ui/select-dropdown'
import useCvCatalogOptions from '@/features/candidate-cvs/hooks/useCvCatalogOptions'
import {
  EMPLOYMENT_TYPE_LABEL,
  EXPERIENCE_LEVEL_LABEL,
  WORK_MODE_LABEL,
} from '@/features/job-discovery/utils'
import { cn } from '@/lib/utils'
import { EMPLOYMENT_TYPE, SALARY_PERIOD, SALARY_TYPE, WORK_MODE } from '@/utils/constant'

import usePositionsByField from '../hooks/usePositionsByField'
import {
  getDeadlineError,
  getReadinessItems,
  getSalaryError,
  todayDateInputValue,
} from '../job-form'
import { SALARY_PERIOD_OPTIONS, SALARY_TYPE_OPTIONS } from '../utils'
import JobStatusBadge from './JobStatusBadge'

const SKILL_MAX_COUNT = 30

function Section({ title, description, children }) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 shadow-xs sm:p-6">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Field({ label, htmlFor, hint, error, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      <p
        className={cn('min-h-[1lh] text-xs', error ? 'text-destructive' : 'text-muted-foreground')}
        id={htmlFor ? `${htmlFor}-hint` : undefined}
        role={error ? 'alert' : undefined}
      >
        {error || hint || ''}
      </p>
    </div>
  )
}

function RemovableChip({ label, onRemove, removeLabel }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-secondary py-1 pr-1 pl-3 text-sm">
      {label}
      <button
        aria-label={removeLabel}
        className="rounded-full p-0.5 text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onRemove}
        type="button"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </span>
  )
}

function ToggleChip({ selected, onClick, children }) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        'inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-input bg-background text-foreground hover:bg-secondary',
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

function useDistricts(provinceCode) {
  const [districtsByProvince, setDistrictsByProvince] = useState({})

  useEffect(() => {
    if (!provinceCode || provinceCode in districtsByProvince) {
      return undefined
    }

    let active = true
    listDistrictLevelUnitsApi(provinceCode).then(
      (data) => {
        if (active) {
          setDistrictsByProvince((current) => ({
            ...current,
            [provinceCode]: data.districtLevelUnits ?? [],
          }))
        }
      },
      () => {
        if (active) {
          setDistrictsByProvince((current) => ({ ...current, [provinceCode]: [] }))
        }
      },
    )

    return () => {
      active = false
    }
  }, [provinceCode, districtsByProvince])

  return districtsByProvince[provinceCode] ?? []
}

function ReadinessPanel({ items, status, saving, submitting, canSubmit, onSaveDraft, onSubmit }) {
  const doneCount = items.filter((item) => item.done).length

  return (
    <aside className="space-y-4 rounded-xl border bg-card p-5 shadow-xs lg:sticky lg:top-24">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Điều kiện gửi duyệt</h2>
        <JobStatusBadge status={status} />
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">
        Đã hoàn thành {doneCount}/{items.length} mục bắt buộc.
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li className="flex items-start gap-2 text-sm" key={item.key}>
            {item.done ? (
              <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-foreground" />
            ) : (
              <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>
              {item.label}
              <span className="sr-only">{item.done ? ' (đã có)' : ' (còn thiếu)'}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 border-t pt-4">
        <Button
          aria-busy={submitting}
          disabled={!canSubmit || saving || submitting}
          onClick={onSubmit}
          type="button"
        >
          {submitting ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <Send aria-hidden="true" className="size-4" />
          )}
          Lưu và gửi duyệt
        </Button>
        <Button
          aria-busy={saving}
          disabled={saving || submitting}
          onClick={onSaveDraft}
          type="button"
          variant="outline"
        >
          {saving && <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}
          Lưu nháp
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Sau khi gửi duyệt, nội dung bị khóa cho đến khi Quản lý công ty xử lý.
      </p>
    </aside>
  )
}

function RecruiterJobForm({ form, onChange, status, saving, submitting, onSaveDraft, onSubmit }) {
  const catalogs = useCvCatalogOptions()
  const { positionsByField, loading: positionsLoading } = usePositionsByField(form.fieldCategoryIds)
  const districts = useDistricts(form.provinceCode)
  const [skillDraft, setSkillDraft] = useState('')

  const set = (patch) => onChange({ ...form, ...patch })

  const fieldNameById = useMemo(
    () => new Map(catalogs.fields.map((field) => [field.id, field.name])),
    [catalogs.fields],
  )
  const positionOptions = useMemo(
    () =>
      form.fieldCategoryIds.flatMap((fieldId) =>
        (positionsByField[fieldId] ?? []).map((position) => ({
          value: position.id,
          label: `${position.name} (${fieldNameById.get(fieldId) ?? 'lĩnh vực'})`,
          name: position.name,
        })),
      ),
    [form.fieldCategoryIds, positionsByField, fieldNameById],
  )
  const positionNameById = new Map(positionOptions.map((option) => [option.value, option.name]))

  const salaryError = getSalaryError(form)
  const deadlineError = getDeadlineError(form)
  const readiness = getReadinessItems(form)
  const canSubmit = readiness.every((item) => item.done)

  const addField = (fieldId) => {
    if (fieldId && !form.fieldCategoryIds.includes(fieldId)) {
      set({ fieldCategoryIds: [...form.fieldCategoryIds, fieldId] })
    }
  }

  const removeField = (fieldId) => {
    // Positions belong to their Field; drop the ones that would become inconsistent.
    const orphanIds = new Set((positionsByField[fieldId] ?? []).map((position) => position.id))
    set({
      fieldCategoryIds: form.fieldCategoryIds.filter((id) => id !== fieldId),
      positionCategoryIds: form.positionCategoryIds.filter((id) => !orphanIds.has(id)),
    })
  }

  const addSkill = () => {
    const skill = skillDraft.trim()
    if (!skill) {
      return
    }
    const exists = form.requiredSkills.some((item) => item.toLowerCase() === skill.toLowerCase())
    if (!exists && form.requiredSkills.length < SKILL_MAX_COUNT) {
      set({ requiredSkills: [...form.requiredSkills, skill] })
    }
    setSkillDraft('')
  }

  const toggleWorkMode = (mode) =>
    set({
      workModes: form.workModes.includes(mode)
        ? form.workModes.filter((item) => item !== mode)
        : [...form.workModes, mode],
    })

  const showMin = form.salaryType && ![SALARY_TYPE.NEGOTIABLE, SALARY_TYPE.UP_TO].includes(form.salaryType)
  const showMax = [SALARY_TYPE.RANGE, SALARY_TYPE.UP_TO].includes(form.salaryType)
  const showPeriod = form.salaryType && form.salaryType !== SALARY_TYPE.NEGOTIABLE

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="min-w-0 space-y-6">
        {catalogs.error && (
          <p
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Không tải được danh mục lĩnh vực, kinh nghiệm hoặc địa điểm. Hãy tải lại trang.
          </p>
        )}

        <Section title="Thông tin chung">
          <Field htmlFor="job-title" label="Tiêu đề vị trí">
            <Input
              autoComplete="off"
              id="job-title"
              maxLength={200}
              name="title"
              onChange={(event) => set({ title: event.target.value })}
              placeholder="Ví dụ: Lập trình viên Backend Node.js"
              value={form.title}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field hint="Có thể chọn nhiều lĩnh vực." htmlFor="job-field" label="Lĩnh vực">
              <SelectDropdown
                ariaLabel="Thêm lĩnh vực"
                disabled={catalogs.loading}
                id="job-field"
                onChange={addField}
                options={catalogs.fields
                  .filter((field) => !form.fieldCategoryIds.includes(field.id))
                  .map((field) => ({ value: field.id, label: field.name }))}
                placeholder={catalogs.loading ? 'Đang tải...' : 'Thêm lĩnh vực'}
                searchable
                value=""
              />
            </Field>
            <Field htmlFor="job-experience" label="Cấp bậc kinh nghiệm">
              <SelectDropdown
                ariaLabel="Cấp bậc kinh nghiệm"
                disabled={catalogs.loading}
                id="job-experience"
                onChange={(value) => set({ experienceLevelId: value })}
                options={catalogs.experienceLevels.map((level) => ({
                  value: level.id,
                  label: EXPERIENCE_LEVEL_LABEL[level.code] ?? level.name ?? level.code,
                }))}
                placeholder="Chọn cấp bậc"
                value={form.experienceLevelId}
              />
            </Field>
          </div>

          {form.fieldCategoryIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.fieldCategoryIds.map((fieldId) => (
                <RemovableChip
                  key={fieldId}
                  label={fieldNameById.get(fieldId) ?? 'Lĩnh vực'}
                  onRemove={() => removeField(fieldId)}
                  removeLabel={`Bỏ lĩnh vực ${fieldNameById.get(fieldId) ?? ''}`}
                />
              ))}
            </div>
          )}

          <Field
            hint={form.fieldCategoryIds.length === 0 ? 'Chọn lĩnh vực trước để thấy vị trí chuyên môn.' : 'Có thể chọn nhiều vị trí.'}
            htmlFor="job-position"
            label="Vị trí chuyên môn"
          >
            <SelectDropdown
              ariaLabel="Thêm vị trí chuyên môn"
              disabled={form.fieldCategoryIds.length === 0 || positionsLoading}
              id="job-position"
              onChange={(value) =>
                value &&
                !form.positionCategoryIds.includes(value) &&
                set({ positionCategoryIds: [...form.positionCategoryIds, value] })
              }
              options={positionOptions.filter((option) => !form.positionCategoryIds.includes(option.value))}
              placeholder={positionsLoading ? 'Đang tải...' : 'Thêm vị trí chuyên môn'}
              searchable
              value=""
            />
          </Field>
          {form.positionCategoryIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.positionCategoryIds.map((positionId) => (
                <RemovableChip
                  key={positionId}
                  label={positionNameById.get(positionId) ?? 'Vị trí'}
                  onRemove={() =>
                    set({ positionCategoryIds: form.positionCategoryIds.filter((id) => id !== positionId) })
                  }
                  removeLabel={`Bỏ vị trí ${positionNameById.get(positionId) ?? ''}`}
                />
              ))}
            </div>
          )}
        </Section>

        <Section title="Mô tả công việc" description="Trách nhiệm, yêu cầu và quyền lợi của vị trí.">
          <RichTextEditor
            onChange={(html) => set({ descriptionHtml: html })}
            placeholder="Mô tả công việc..."
            value={form.descriptionHtml}
          />
        </Section>

        <Section title="Kỹ năng yêu cầu">
          <Field hint="Nhấn Enter để thêm từng kỹ năng." htmlFor="job-skill" label="Kỹ năng">
            <div className="flex gap-2">
              <Input
                autoComplete="off"
                id="job-skill"
                maxLength={100}
                name="skill"
                onChange={(event) => setSkillDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addSkill()
                  }
                }}
                placeholder="Ví dụ: Node.js"
                value={skillDraft}
              />
              <Button aria-label="Thêm kỹ năng" className="h-11" onClick={addSkill} type="button" variant="outline">
                <Plus aria-hidden="true" className="size-4" />
                Thêm
              </Button>
            </div>
          </Field>
          {form.requiredSkills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.requiredSkills.map((skill) => (
                <RemovableChip
                  key={skill}
                  label={skill}
                  onRemove={() => set({ requiredSkills: form.requiredSkills.filter((item) => item !== skill) })}
                  removeLabel={`Bỏ kỹ năng ${skill}`}
                />
              ))}
            </div>
          )}
        </Section>

        <Section title="Hình thức và địa điểm">
          <Field htmlFor="job-employment" label="Loại hình công việc">
            <SelectDropdown
              ariaLabel="Loại hình công việc"
              id="job-employment"
              onChange={(value) => set({ employmentType: value })}
              options={Object.values(EMPLOYMENT_TYPE).map((type) => ({
                value: type,
                label: EMPLOYMENT_TYPE_LABEL[type] ?? type,
              }))}
              placeholder="Chọn loại hình"
              value={form.employmentType}
            />
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Hình thức làm việc</legend>
            <div className="flex flex-wrap gap-2">
              {Object.values(WORK_MODE).map((mode) => (
                <ToggleChip
                  key={mode}
                  onClick={() => toggleWorkMode(mode)}
                  selected={form.workModes.includes(mode)}
                >
                  {WORK_MODE_LABEL[mode] ?? mode}
                </ToggleChip>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor="job-province" label="Tỉnh/Thành phố">
              <SelectDropdown
                ariaLabel="Tỉnh/Thành phố"
                disabled={catalogs.loading}
                id="job-province"
                onChange={(value) => set({ provinceCode: value, districtCode: '' })}
                options={catalogs.provinces.map((province) => ({ value: province.code, label: province.name }))}
                placeholder="Chọn tỉnh/thành phố"
                searchable
                value={form.provinceCode}
              />
            </Field>
            <Field hint="Không bắt buộc." htmlFor="job-district" label="Quận/Huyện">
              <SelectDropdown
                ariaLabel="Quận/Huyện"
                disabled={!form.provinceCode}
                id="job-district"
                onChange={(value) => set({ districtCode: value })}
                options={[
                  { value: '', label: 'Toàn tỉnh/thành phố' },
                  ...districts.map((district) => ({ value: district.code, label: district.name })),
                ]}
                placeholder="Chọn quận/huyện"
                searchable
                value={form.districtCode}
              />
            </Field>
          </div>
        </Section>

        <Section title="Mức lương" description="Số tiền tính bằng VNĐ.">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Kiểu lương</legend>
            <div className="flex flex-wrap gap-2">
              {SALARY_TYPE_OPTIONS.map((option) => (
                <ToggleChip
                  key={option.value}
                  onClick={() => set({ salaryType: option.value })}
                  selected={form.salaryType === option.value}
                >
                  {option.label}
                </ToggleChip>
              ))}
            </div>
          </fieldset>

          {showPeriod && (
            <div className="grid gap-4 sm:grid-cols-3">
              {showMin && (
                <Field
                  htmlFor="job-salary-min"
                  label={form.salaryType === SALARY_TYPE.FIXED ? 'Mức lương' : 'Tối thiểu'}
                >
                  <Input
                    id="job-salary-min"
                    inputMode="numeric"
                    name="minAmount"
                    onChange={(event) => set({ minAmount: event.target.value.replace(/\D/g, '') })}
                    placeholder="15000000"
                    value={form.minAmount}
                  />
                </Field>
              )}
              {showMax && (
                <Field htmlFor="job-salary-max" label="Tối đa">
                  <Input
                    id="job-salary-max"
                    inputMode="numeric"
                    name="maxAmount"
                    onChange={(event) => set({ maxAmount: event.target.value.replace(/\D/g, '') })}
                    placeholder="25000000"
                    value={form.maxAmount}
                  />
                </Field>
              )}
              <Field htmlFor="job-salary-period" label="Kỳ trả lương">
                <SelectDropdown
                  ariaLabel="Kỳ trả lương"
                  id="job-salary-period"
                  onChange={(value) => set({ salaryPeriod: value })}
                  options={SALARY_PERIOD_OPTIONS}
                  value={form.salaryPeriod}
                />
              </Field>
              {form.salaryPeriod === SALARY_PERIOD.ETC && (
                <Field htmlFor="job-salary-custom" label="Tên kỳ trả lương">
                  <Input
                    id="job-salary-custom"
                    maxLength={50}
                    name="customPeriodLabel"
                    onChange={(event) => set({ customPeriodLabel: event.target.value })}
                    placeholder="Ví dụ: dự án"
                    value={form.customPeriodLabel}
                  />
                </Field>
              )}
            </div>
          )}
          {salaryError && (
            <p className="text-sm text-destructive" role="alert">
              {salaryError}
            </p>
          )}
        </Section>

        <Section title="Hạn nhận hồ sơ">
          <Field error={deadlineError} htmlFor="job-deadline" hint="Hồ sơ được nhận đến hết ngày đã chọn." label="Ngày hết hạn">
            <Input
              aria-describedby="job-deadline-hint"
              aria-invalid={Boolean(deadlineError)}
              className="sm:max-w-60"
              id="job-deadline"
              min={todayDateInputValue()}
              name="applicationDeadline"
              onChange={(event) => set({ applicationDeadline: event.target.value })}
              type="date"
              value={form.applicationDeadline}
            />
          </Field>
        </Section>
      </div>

      <ReadinessPanel
        canSubmit={canSubmit}
        items={readiness}
        onSaveDraft={onSaveDraft}
        onSubmit={onSubmit}
        saving={saving}
        status={status}
        submitting={submitting}
      />
    </div>
  )
}

export default RecruiterJobForm
