import { SALARY_PERIOD, SALARY_TYPE } from '@/utils/constant'

const EMPTY_JOB_FORM = Object.freeze({
  title: '',
  descriptionHtml: '',
  requiredSkills: [],
  fieldCategoryIds: [],
  positionCategoryIds: [],
  provinceCode: '',
  districtCode: '',
  employmentType: '',
  workModes: [],
  experienceLevelId: '',
  salaryType: '',
  minAmount: '',
  maxAmount: '',
  salaryPeriod: SALARY_PERIOD.MONTH,
  customPeriodLabel: '',
  applicationDeadline: '',
})

function pad(value) {
  return String(value).padStart(2, '0')
}

function toDateInputValue(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function todayDateInputValue() {
  return toDateInputValue(new Date())
}

// The deadline is chosen as a calendar day and ends at 23:59:59 local time.
function toDeadlineInstant(dateValue) {
  if (!dateValue) {
    return null
  }

  const date = new Date(`${dateValue}T23:59:59`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function toAmount(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits === '' ? null : Number(digits)
}

function jobToForm(job) {
  if (!job) {
    return { ...EMPTY_JOB_FORM }
  }

  const salary = job.salary
  const isFixed = salary?.type === SALARY_TYPE.FIXED

  return {
    title: job.title ?? '',
    descriptionHtml: job.jobDescriptionHtml ?? (job.jobDescription ? `<p>${escapeHtml(job.jobDescription)}</p>` : ''),
    requiredSkills: job.requiredSkills ?? [],
    fieldCategoryIds: job.fieldCategoryIds ?? [],
    positionCategoryIds: job.positionCategoryIds ?? [],
    provinceCode: job.location?.provinceCode ?? '',
    districtCode: job.location?.districtCode ?? '',
    employmentType: job.employmentType ?? '',
    workModes: job.workModes ?? [],
    experienceLevelId: job.experienceLevelId ?? '',
    salaryType: salary?.type ?? '',
    minAmount: salary?.minAmount == null ? '' : String(salary.minAmount),
    maxAmount: isFixed || salary?.maxAmount == null ? '' : String(salary.maxAmount),
    salaryPeriod: salary?.period ?? SALARY_PERIOD.MONTH,
    customPeriodLabel: salary?.customPeriodLabel ?? '',
    applicationDeadline: toDateInputValue(job.applicationDeadline),
  }
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function formToSalary(form) {
  if (!form.salaryType) {
    return null
  }

  if (form.salaryType === SALARY_TYPE.NEGOTIABLE) {
    return {
      type: SALARY_TYPE.NEGOTIABLE,
      minAmount: null,
      maxAmount: null,
      period: null,
      customPeriodLabel: null,
    }
  }

  const min = toAmount(form.minAmount)
  const max = toAmount(form.maxAmount)
  const amounts = {
    [SALARY_TYPE.FIXED]: { minAmount: min, maxAmount: min },
    [SALARY_TYPE.RANGE]: { minAmount: min, maxAmount: max },
    [SALARY_TYPE.FROM]: { minAmount: min, maxAmount: null },
    [SALARY_TYPE.UP_TO]: { minAmount: null, maxAmount: max },
  }[form.salaryType]
  const isCustomPeriod = form.salaryPeriod === SALARY_PERIOD.ETC

  return {
    type: form.salaryType,
    ...amounts,
    period: form.salaryPeriod || null,
    customPeriodLabel: isCustomPeriod ? form.customPeriodLabel.trim() || null : null,
  }
}

// Draft payload: every field is optional on DRAFT; the backend enforces completeness on submit.
function formToPayload(form) {
  return {
    title: form.title.trim() || null,
    jobDescriptionHtml: form.descriptionHtml || null,
    requiredSkills: form.requiredSkills,
    salary: formToSalary(form),
    fieldCategoryIds: form.fieldCategoryIds,
    positionCategoryIds: form.positionCategoryIds,
    location: form.provinceCode
      ? { provinceCode: form.provinceCode, districtCode: form.districtCode || null }
      : null,
    employmentType: form.employmentType || null,
    workModes: form.workModes,
    experienceLevelId: form.experienceLevelId || null,
    applicationDeadline: toDeadlineInstant(form.applicationDeadline),
  }
}

function getSalaryError(form) {
  if (!form.salaryType || form.salaryType === SALARY_TYPE.NEGOTIABLE) {
    return null
  }

  const min = toAmount(form.minAmount)
  const max = toAmount(form.maxAmount)
  const needsMin = form.salaryType !== SALARY_TYPE.UP_TO
  const needsMax = form.salaryType === SALARY_TYPE.RANGE || form.salaryType === SALARY_TYPE.UP_TO

  if ((needsMin && min == null) || (needsMax && max == null)) {
    return 'Nhập đủ số tiền cho kiểu lương đã chọn.'
  }

  if (form.salaryType === SALARY_TYPE.RANGE && min > max) {
    return 'Mức tối thiểu không được lớn hơn mức tối đa.'
  }

  if (form.salaryPeriod === SALARY_PERIOD.ETC && !form.customPeriodLabel.trim()) {
    return 'Nhập tên kỳ trả lương khi chọn "Khác".'
  }

  return null
}

function getDeadlineError(form) {
  if (!form.applicationDeadline) {
    return null
  }

  return form.applicationDeadline < todayDateInputValue()
    ? 'Hạn nhận hồ sơ phải từ hôm nay trở đi.'
    : null
}

// Mirrors backend assertJobContentCompleteForLifecycle (V5 BR-10 to BR-15), one item
// per required field, for guidance only; the backend decides.
function getReadinessItems(form) {
  const hasDescription = form.descriptionHtml.replace(/<[^>]*>/g, '').trim() !== ''

  return [
    { key: 'title', label: 'Tiêu đề vị trí', done: form.title.trim() !== '' },
    { key: 'description', label: 'Mô tả công việc', done: hasDescription },
    { key: 'salary', label: 'Mức lương', done: Boolean(form.salaryType) && !getSalaryError(form) },
    { key: 'skills', label: 'Kỹ năng yêu cầu', done: form.requiredSkills.length > 0 },
    { key: 'fields', label: 'Lĩnh vực', done: form.fieldCategoryIds.length > 0 },
    { key: 'positions', label: 'Vị trí chuyên môn', done: form.positionCategoryIds.length > 0 },
    { key: 'location', label: 'Địa điểm', done: Boolean(form.provinceCode) },
    { key: 'employment', label: 'Loại hình công việc', done: Boolean(form.employmentType) },
    { key: 'workModes', label: 'Hình thức làm việc', done: form.workModes.length > 0 },
    { key: 'experience', label: 'Cấp bậc kinh nghiệm', done: Boolean(form.experienceLevelId) },
    {
      key: 'deadline',
      label: 'Hạn nhận hồ sơ',
      done: Boolean(form.applicationDeadline) && !getDeadlineError(form),
    },
  ]
}

export {
  EMPTY_JOB_FORM,
  formToPayload,
  getDeadlineError,
  getReadinessItems,
  getSalaryError,
  jobToForm,
  todayDateInputValue,
}
