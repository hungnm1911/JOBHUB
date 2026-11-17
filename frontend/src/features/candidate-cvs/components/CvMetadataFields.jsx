import { Input } from '@/components/ui/Input'
import { EXPERIENCE_LEVEL_LABEL } from '@/features/job-discovery/utils'
import { CANDIDATE_CV_VISIBILITY } from '@/utils/constant'

import { CV_VISIBILITY_LABEL } from '../utils'

function Field({ label, htmlFor, children, hint }) {
  return (
    <label className="block space-y-1.5" htmlFor={htmlFor}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

function CvMetadataFields({
  idPrefix,
  values,
  onChange,
  fields,
  experienceLevels,
  catalogsLoading,
  catalogsError,
  includeExperienceLevel = true,
}) {
  return (
    <div className="space-y-4">
      <Field htmlFor={`${idPrefix}-name`} label="Tên CV">
        <Input
          id={`${idPrefix}-name`}
          maxLength={120}
          onChange={(event) => onChange({ ...values, name: event.target.value })}
          placeholder="Ví dụ: CV Frontend 2026"
          required
          value={values.name}
        />
      </Field>

      <Field htmlFor={`${idPrefix}-visibility`} label="Chế độ hiển thị">
        <select
          className="flex h-11 w-full rounded-md border border-input bg-secondary/60 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          id={`${idPrefix}-visibility`}
          onChange={(event) => onChange({ ...values, visibility: event.target.value })}
          value={values.visibility}
        >
          {Object.values(CANDIDATE_CV_VISIBILITY).map((value) => (
            <option key={value} value={value}>
              {CV_VISIBILITY_LABEL[value]}
            </option>
          ))}
        </select>
      </Field>

      <Field
        hint={
          catalogsError
            ? 'Không tải được danh mục ngành. Thử lại sau.'
            : 'Chọn lĩnh vực nghề nghiệp cho CV.'
        }
        htmlFor={`${idPrefix}-category`}
        label="Ngành nghề"
      >
        <select
          className="flex h-11 w-full rounded-md border border-input bg-secondary/60 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
          disabled={catalogsLoading || Boolean(catalogsError)}
          id={`${idPrefix}-category`}
          onChange={(event) => onChange({ ...values, categoryId: event.target.value })}
          required
          value={values.categoryId}
        >
          <option value="">
            {catalogsLoading ? 'Đang tải danh mục…' : 'Chọn ngành nghề'}
          </option>
          {fields.map((field) => (
            <option key={field.id} value={field.id}>
              {field.name}
            </option>
          ))}
        </select>
      </Field>

      {includeExperienceLevel ? (
        <Field htmlFor={`${idPrefix}-experience`} label="Kinh nghiệm (tuỳ chọn)">
          <select
            className="flex h-11 w-full rounded-md border border-input bg-secondary/60 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
            disabled={catalogsLoading || Boolean(catalogsError)}
            id={`${idPrefix}-experience`}
            onChange={(event) =>
              onChange({
                ...values,
                experienceLevelId: event.target.value || '',
              })
            }
            value={values.experienceLevelId}
          >
            <option value="">Không chọn</option>
            {experienceLevels.map((level) => (
              <option key={level.id} value={level.id}>
                {EXPERIENCE_LEVEL_LABEL[level.code] ?? level.code}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
    </div>
  )
}

export default CvMetadataFields
