import {
  API_ERROR_MESSAGE,
  EMPLOYMENT_TYPE,
  EXPERIENCE_LEVEL,
  JOB_STATUS,
  SALARY_PERIOD,
  SALARY_TYPE,
  WORK_MODE,
} from '@/utils/constant'

const WORK_MODE_LABEL = Object.freeze({
  [WORK_MODE.ONSITE]: 'Tại văn phòng',
  [WORK_MODE.HYBRID]: 'Hybrid',
  [WORK_MODE.REMOTE]: 'Từ xa',
})

const EMPLOYMENT_TYPE_LABEL = Object.freeze({
  [EMPLOYMENT_TYPE.FULL_TIME]: 'Toàn thời gian',
  [EMPLOYMENT_TYPE.PART_TIME]: 'Bán thời gian',
  [EMPLOYMENT_TYPE.INTERNSHIP]: 'Thực tập',
  [EMPLOYMENT_TYPE.CONTRACT]: 'Hợp đồng',
  [EMPLOYMENT_TYPE.TEMPORARY]: 'Tạm thời',
  [EMPLOYMENT_TYPE.FREELANCE]: 'Freelance',
  [EMPLOYMENT_TYPE.SEASONAL]: 'Thời vụ',
  [EMPLOYMENT_TYPE.APPRENTICESHIP]: 'Học việc',
})

const EXPERIENCE_LEVEL_LABEL = Object.freeze({
  [EXPERIENCE_LEVEL.NO_EXPERIENCE]: 'Không yêu cầu kinh nghiệm',
  [EXPERIENCE_LEVEL.UNDER_1_YEAR]: 'Dưới 1 năm',
  [EXPERIENCE_LEVEL.ONE_TO_THREE_YEARS]: '1 – 3 năm',
  [EXPERIENCE_LEVEL.THREE_TO_FIVE_YEARS]: '3 – 5 năm',
  [EXPERIENCE_LEVEL.FIVE_TO_TEN_YEARS]: '5 – 10 năm',
  [EXPERIENCE_LEVEL.OVER_TEN_YEARS]: 'Trên 10 năm',
})

const SALARY_PERIOD_SUFFIX = Object.freeze({
  [SALARY_PERIOD.HOUR]: 'giờ',
  [SALARY_PERIOD.DAY]: 'ngày',
  [SALARY_PERIOD.WEEK]: 'tuần',
  [SALARY_PERIOD.MONTH]: 'tháng',
  [SALARY_PERIOD.SHIFT]: 'ca',
})

const MILLION = 1_000_000

const numberFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })
const dateFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' })
const relativeTimeFormatter = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' })

function formatAmount(amount, inMillions) {
  return inMillions
    ? numberFormatter.format(amount / MILLION)
    : `${numberFormatter.format(amount)} đ`
}

function formatSalary(salary) {
  if (!salary) {
    return 'Chưa công bố lương'
  }

  if (salary.type === SALARY_TYPE.NEGOTIABLE) {
    return 'Thỏa thuận'
  }

  const amounts = [salary.minAmount, salary.maxAmount].filter((amount) => amount != null)
  const inMillions = amounts.every((amount) => amount >= MILLION)
  const unit = inMillions ? ' triệu' : ''
  const min = salary.minAmount == null ? null : formatAmount(salary.minAmount, inMillions)
  const max = salary.maxAmount == null ? null : formatAmount(salary.maxAmount, inMillions)

  let value
  if (salary.type === SALARY_TYPE.RANGE) {
    value = `${min} – ${max}${unit}`
  } else if (salary.type === SALARY_TYPE.FROM) {
    value = `Từ ${min}${unit}`
  } else if (salary.type === SALARY_TYPE.UP_TO) {
    value = `Đến ${max}${unit}`
  } else {
    value = `${min ?? max}${unit}`
  }

  const period =
    salary.period === SALARY_PERIOD.ETC
      ? salary.customPeriodLabel
      : SALARY_PERIOD_SUFFIX[salary.period]

  return period ? `${value}/${period}` : value
}

function formatProvince(location, provinceNameByCode) {
  if (!location?.provinceCode) {
    return null
  }

  return provinceNameByCode.get(location.provinceCode) ?? null
}

function formatWorkModes(workModes = []) {
  return workModes.map((workMode) => WORK_MODE_LABEL[workMode] ?? workMode).join(', ')
}

function formatDate(value) {
  return value ? dateFormatter.format(new Date(value)) : null
}

const RELATIVE_TIME_UNITS = [
  { unit: 'year', seconds: 365 * 24 * 60 * 60 },
  { unit: 'month', seconds: 30 * 24 * 60 * 60 },
  { unit: 'week', seconds: 7 * 24 * 60 * 60 },
  { unit: 'day', seconds: 24 * 60 * 60 },
  { unit: 'hour', seconds: 60 * 60 },
  { unit: 'minute', seconds: 60 },
]

function formatRelativeTime(value, now = Date.now()) {
  if (!value) {
    return null
  }

  const elapsedSeconds = Math.round((new Date(value).getTime() - now) / 1000)
  const match = RELATIVE_TIME_UNITS.find(({ seconds }) => Math.abs(elapsedSeconds) >= seconds)

  if (!match) {
    return 'vừa xong'
  }

  return relativeTimeFormatter.format(Math.round(elapsedSeconds / match.seconds), match.unit)
}

function getCompanyInitials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) {
    return '?'
  }

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase()
  }

  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function getJobTags(job, maxTags = 3) {
  const categories =
    job.positionCategories?.length > 0 ? job.positionCategories : job.fieldCategories ?? []

  return categories.slice(0, maxTags).map((category) => category.name)
}

function getHistoricalJobLabel(job) {
  return job.status === JOB_STATUS.CLOSED ? 'Đã đóng' : 'Đã hết hạn'
}

function toJobDiscoveryErrorMessage(error, notFoundMessage = API_ERROR_MESSAGE.JOB_NOT_FOUND) {
  if (error?.status === 404 || error?.status === 400) {
    return notFoundMessage
  }

  if (error?.status === 403) {
    return API_ERROR_MESSAGE.JOB_DISCOVERY_NOT_AVAILABLE
  }

  return error?.message ?? API_ERROR_MESSAGE.UNEXPECTED
}

export {
  EMPLOYMENT_TYPE_LABEL,
  EXPERIENCE_LEVEL_LABEL,
  formatDate,
  formatProvince,
  formatRelativeTime,
  formatSalary,
  formatWorkModes,
  getCompanyInitials,
  getHistoricalJobLabel,
  getJobTags,
  SALARY_PERIOD_SUFFIX,
  toJobDiscoveryErrorMessage,
  WORK_MODE_LABEL,
}
