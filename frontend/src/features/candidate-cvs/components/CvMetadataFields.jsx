import { Globe, Lock, MapPin, Plus, Tag, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { listPositionCategoriesApi } from '@/apis/category.api'
import { listDistrictLevelUnitsApi } from '@/apis/location.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectDropdown } from '@/components/ui/select-dropdown'
import {
  EMPLOYMENT_TYPE_LABEL,
  EXPERIENCE_LEVEL_LABEL,
  WORK_MODE_LABEL,
} from '@/features/job-discovery/utils'
import { cn } from '@/lib/utils'
import {
  CANDIDATE_CV_VISIBILITY,
  EMPLOYMENT_TYPE,
  WORK_MODE,
} from '@/utils/constant'

import { CV_VISIBILITY_LABEL } from '../utils'

const VISIBILITY_OPTIONS = [
  {
    value: CANDIDATE_CV_VISIBILITY.PRIVATE,
    icon: Lock,
    label: CV_VISIBILITY_LABEL[CANDIDATE_CV_VISIBILITY.PRIVATE] ?? 'Riêng tư',
    activeClass: 'border-primary bg-primary text-primary-foreground',
  },
  {
    value: CANDIDATE_CV_VISIBILITY.PUBLIC,
    icon: Globe,
    label: CV_VISIBILITY_LABEL[CANDIDATE_CV_VISIBILITY.PUBLIC] ?? 'Công khai',
    activeClass: 'border-emerald-600 bg-emerald-600 text-white',
  },
]

function Field({ label, htmlFor, children, required = false }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-foreground" htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
    </div>
  )
}

function CvMetadataFields({
  idPrefix,
  values,
  onChange,
  fields = [],
  experienceLevels = [],
  provinces = [],
  catalogsLoading = false,
  catalogsError = null,
}) {
  const [positionsByField, setPositionsByField] = useState({})

  const [skillInput, setSkillInput] = useState('')
  const [locProvinceCode, setLocProvinceCode] = useState('')
  const [locDistrictCode, setLocDistrictCode] = useState('')
  const [districtsByProvince, setDistrictsByProvince] = useState({})

  const activeFieldId = useMemo(() => {
    if (values.categoryId && fields.some((f) => f.id === values.categoryId)) {
      return values.categoryId
    }
    // CandidateCV stores one Category ID. For a saved POSITION, recover its
    // FIELD from the canonical catalog when this form mounts again.
    return fields.find((field) => positionsByField[field.id]?.some(
      (position) => position.id === values.categoryId,
    ))?.id ?? ''
  }, [values.categoryId, fields, positionsByField])

  const positionsLoading = Boolean(activeFieldId) && !positionsByField[activeFieldId]
  const positions = useMemo(
    () => positionsByField[activeFieldId] ?? [],
    [positionsByField, activeFieldId],
  )
  const districtsLoading = Boolean(locProvinceCode) && !districtsByProvince[locProvinceCode]

  useEffect(() => {
    const fieldIds = activeFieldId ? [activeFieldId] : values.categoryId ? fields.map((field) => field.id) : []
    const missingFieldIds = fieldIds.filter((fieldId) => !positionsByField[fieldId])
    if (missingFieldIds.length === 0) {
      return undefined
    }
    let active = true
    Promise.all(missingFieldIds.map(async (fieldId) => {
      try {
        const { positions } = await listPositionCategoriesApi(fieldId)
        return [fieldId, positions ?? []]
      } catch {
        return [fieldId, []]
      }
    })).then((entries) => {
      if (active) {
        setPositionsByField((current) => ({ ...current, ...Object.fromEntries(entries) }))
      }
    })
    return () => {
      active = false
    }
  }, [activeFieldId, values.categoryId, fields, positionsByField])

  useEffect(() => {
    if (!locProvinceCode || districtsByProvince[locProvinceCode]) {
      return undefined
    }
    let active = true
    listDistrictLevelUnitsApi(locProvinceCode).then(
      (res) => {
        if (active) {
          setDistrictsByProvince((prev) => ({
            ...prev,
            [locProvinceCode]: res.districtLevelUnits ?? [],
          }))
        }
      },
      () => {
        if (active) {
          setDistrictsByProvince((prev) => ({
            ...prev,
            [locProvinceCode]: [],
          }))
        }
      },
    )
    return () => {
      active = false
    }
  }, [locProvinceCode, districtsByProvince])

  const currentPositionId =
    values.categoryId && values.categoryId !== activeFieldId ? values.categoryId : ''

  const handleFieldSelect = (nextFieldId) => {
    onChange({
      ...values,
      categoryId: nextFieldId,
    })
  }

  const handlePositionSelect = (nextPositionId) => {
    onChange({
      ...values,
      categoryId: nextPositionId || activeFieldId,
    })
  }

  const skillTags = values.skillTags ?? []
  const employmentTypes = values.employmentTypes ?? []
  const workModes = values.workModes ?? []
  const preferredLocations = values.preferredLocations ?? []

  const addSkillTag = () => {
    const raw = skillInput.trim()
    if (!raw) {
      return
    }
    const entries = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const next = [...skillTags]
    for (const item of entries) {
      if (!next.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
        next.push(item)
      }
    }
    onChange({ ...values, skillTags: next })
    setSkillInput('')
  }

  const removeSkillTag = (tagToRemove) => {
    onChange({
      ...values,
      skillTags: skillTags.filter((tag) => tag !== tagToRemove),
    })
  }

  const toggleEnumItem = (fieldKey, currentList, itemValue) => {
    const exists = currentList.includes(itemValue)
    const next = exists
      ? currentList.filter((item) => item !== itemValue)
      : [...currentList, itemValue]
    onChange({ ...values, [fieldKey]: next })
  }

  const addPreferredLocation = () => {
    if (!locProvinceCode) {
      return
    }
    const districtCode = locDistrictCode || null
    const cleaned = preferredLocations.filter((loc) => {
      if (loc.provinceCode !== locProvinceCode) {
        return true
      }
      if (districtCode == null || loc.districtCode == null) {
        return false
      }
      return loc.districtCode !== districtCode
    })

    onChange({
      ...values,
      preferredLocations: [
        ...cleaned,
        { provinceCode: locProvinceCode, districtCode },
      ],
    })
    setLocDistrictCode('')
  }

  const removePreferredLocation = (index) => {
    onChange({
      ...values,
      preferredLocations: preferredLocations.filter((_, idx) => idx !== index),
    })
  }

  const provinceNameByCode = useMemo(
    () => new Map(provinces.map((p) => [p.code, p.name])),
    [provinces],
  )

  const formatLocationChip = (loc) => {
    const pName = provinceNameByCode.get(loc.provinceCode) ?? loc.provinceCode
    if (!loc.districtCode) {
      return pName
    }
    const districts = districtsByProvince[loc.provinceCode] ?? []
    const dName = districts.find((d) => d.code === loc.districtCode)?.name ?? loc.districtCode
    return `${dName}, ${pName}`
  }

  const activeDistricts = useMemo(
    () => (locProvinceCode ? (districtsByProvince[locProvinceCode] ?? []) : []),
    [locProvinceCode, districtsByProvince],
  )

  const fieldOptions = useMemo(
    () => fields.map((field) => ({ value: field.id, label: field.name })),
    [fields],
  )

  const positionOptions = useMemo(
    () => [
      { value: '', label: 'Toàn ngành' },
      ...positions.map((pos) => ({ value: pos.id, label: pos.name })),
    ],
    [positions],
  )

  const experienceOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả mức' },
      ...experienceLevels.map((level) => ({
        value: level.id,
        label: EXPERIENCE_LEVEL_LABEL[level.code] ?? level.name ?? level.code,
      })),
    ],
    [experienceLevels],
  )

  const provinceOptions = useMemo(
    () => provinces.map((p) => ({ value: p.code, label: p.name })),
    [provinces],
  )

  const districtOptions = useMemo(
    () => [
      { value: '', label: 'Toàn tỉnh / thành' },
      ...activeDistricts.map((d) => ({ value: d.code, label: d.name })),
    ],
    [activeDistricts],
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-3.5 sm:grid-cols-[1fr_auto]">
        <Field htmlFor={`${idPrefix}-name`} label="Tên CV" required>
          <Input
            className="h-10 rounded-xl"
            id={`${idPrefix}-name`}
            maxLength={120}
            onChange={(event) => onChange({ ...values, name: event.target.value })}
            placeholder="VD: CV Frontend Engineer 2026"
            required
            value={values.name}
          />
        </Field>

        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-foreground">Hiển thị</span>
          <div className="inline-flex h-10 items-center gap-1 rounded-xl border bg-secondary/50 p-1">
            {VISIBILITY_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const active = values.visibility === opt.value
              return (
                <button
                  aria-pressed={active}
                  className={cn(
                    'inline-flex h-full items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all',
                    active
                      ? opt.activeClass
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  key={opt.value}
                  onClick={() => onChange({ ...values, visibility: opt.value })}
                  type="button"
                >
                  <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                  <span>{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-3">
        <Field htmlFor={`${idPrefix}-field`} label="Ngành nghề" required>
          <SelectDropdown
            disabled={catalogsLoading || Boolean(catalogsError)}
            id={`${idPrefix}-field`}
            onChange={handleFieldSelect}
            options={fieldOptions}
            placeholder={catalogsLoading ? 'Đang tải…' : 'Chọn ngành nghề'}
            searchPlaceholder="Tìm ngành nghề..."
            value={activeFieldId}
          />
        </Field>

        <Field htmlFor={`${idPrefix}-position`} label="Vị trí chuyên môn">
          <SelectDropdown
            disabled={!activeFieldId || positionsLoading || positions.length === 0}
            id={`${idPrefix}-position`}
            onChange={handlePositionSelect}
            options={positionOptions}
            placeholder={
              !activeFieldId
                ? 'Chọn ngành trước'
                : positionsLoading
                  ? 'Đang tải…'
                  : 'Toàn ngành'
            }
            searchPlaceholder="Tìm vị trí..."
            value={currentPositionId}
          />
        </Field>

        <Field htmlFor={`${idPrefix}-experience`} label="Kinh nghiệm">
          <SelectDropdown
            disabled={catalogsLoading || Boolean(catalogsError)}
            id={`${idPrefix}-experience`}
            onChange={(nextValue) =>
              onChange({
                ...values,
                experienceLevelId: nextValue || '',
              })
            }
            options={experienceOptions}
            placeholder="Tất cả mức"
            value={values.experienceLevelId ?? ''}
          />
        </Field>
      </div>

      <Field htmlFor={`${idPrefix}-skill-tags`} label="Từ khóa kỹ năng (Skill Tags)">
        <div className="flex gap-2">
          <Input
            className="h-10 rounded-xl"
            id={`${idPrefix}-skill-tags`}
            onChange={(event) => setSkillInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addSkillTag()
              }
            }}
            placeholder="React, TypeScript, Node.js... (nhấn Enter để thêm)"
            value={skillInput}
          />
          <Button className="h-10 rounded-xl" onClick={addSkillTag} type="button" variant="outline">
            <Plus aria-hidden="true" className="size-4" />
            Thêm
          </Button>
        </div>
        {skillTags.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {skillTags.map((tag) => (
              <li
                className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 py-0.5 pr-1.5 pl-2.5 text-xs font-medium text-primary"
                key={tag}
              >
                <Tag aria-hidden="true" className="size-3" />
                <span>{tag}</span>
                <button
                  aria-label={`Xóa ${tag}`}
                  className="inline-flex size-4 items-center justify-center rounded-full hover:bg-primary/20"
                  onClick={() => removeSkillTag(tag)}
                  type="button"
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Field>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">Hình thức làm việc</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(EMPLOYMENT_TYPE).map((type) => {
              const selected = employmentTypes.includes(type)
              return (
                <button
                  aria-pressed={selected}
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                  key={type}
                  onClick={() => toggleEnumItem('employmentTypes', employmentTypes, type)}
                  type="button"
                >
                  {EMPLOYMENT_TYPE_LABEL[type] ?? type}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">Chế độ làm việc</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(WORK_MODE).map((mode) => {
              const selected = workModes.includes(mode)
              return (
                <button
                  aria-pressed={selected}
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                  key={mode}
                  onClick={() => toggleEnumItem('workModes', workModes, mode)}
                  type="button"
                >
                  {WORK_MODE_LABEL[mode] ?? mode}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <Field htmlFor={`${idPrefix}-location-province`} label="Địa điểm mong muốn">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <SelectDropdown
            disabled={catalogsLoading || provinces.length === 0}
            id={`${idPrefix}-location-province`}
            onChange={(nextProvinceCode) => {
              setLocProvinceCode(nextProvinceCode)
              setLocDistrictCode('')
            }}
            options={provinceOptions}
            placeholder="Chọn Tỉnh / Thành phố"
            searchPlaceholder="Tìm tỉnh / thành phố..."
            value={locProvinceCode}
          />

          <SelectDropdown
            ariaLabel="Quận / Huyện"
            disabled={!locProvinceCode || districtsLoading || activeDistricts.length === 0}
            onChange={setLocDistrictCode}
            options={districtOptions}
            placeholder={districtsLoading ? 'Đang tải…' : 'Toàn tỉnh / thành'}
            searchPlaceholder="Tìm quận / huyện..."
            value={locDistrictCode}
          />

          <Button
            className="h-10 rounded-xl"
            disabled={!locProvinceCode}
            onClick={addPreferredLocation}
            type="button"
            variant="outline"
          >
            <Plus aria-hidden="true" className="size-4" />
            Thêm
          </Button>
        </div>

        {preferredLocations.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {preferredLocations.map((loc, index) => (
              <li
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 py-0.5 pr-1.5 pl-2.5 text-xs font-medium text-foreground"
                key={`${loc.provinceCode}-${loc.districtCode ?? 'ALL'}`}
              >
                <MapPin aria-hidden="true" className="size-3 text-primary" />
                <span>{formatLocationChip(loc)}</span>
                <button
                  aria-label="Xóa địa điểm"
                  className="inline-flex size-4 items-center justify-center rounded-full hover:bg-foreground/10"
                  onClick={() => removePreferredLocation(index)}
                  type="button"
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Field>
    </div>
  )
}

export default CvMetadataFields
