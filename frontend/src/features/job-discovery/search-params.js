import { EMPLOYMENT_TYPE, SALARY_PERIOD, WORK_MODE } from '@/utils/constant'

const JOB_DISCOVERY_SORT = Object.freeze({
  NEWEST: 'NEWEST',
  RELEVANCE: 'RELEVANCE',
  EXPIRING_SOON: 'EXPIRING_SOON',
})

// V4.2 BR-10: ETC is display-only and never takes part in Salary filtering.
const FILTERABLE_SALARY_PERIODS = Object.freeze(
  Object.values(SALARY_PERIOD).filter((period) => period !== SALARY_PERIOD.ETC),
)

const SEARCH_PARAM = Object.freeze({
  KEYWORD: 'q',
  CATEGORIES: 'categories',
  LOCATIONS: 'locations',
  WORK_MODES: 'workModes',
  EMPLOYMENT_TYPES: 'employmentTypes',
  EXPERIENCE_LEVELS: 'experienceLevels',
  SALARY_PERIOD: 'salaryPeriod',
  SALARY_MIN: 'salaryMin',
  SALARY_MAX: 'salaryMax',
  SORT: 'sort',
  PAGE: 'page',
})

const WORK_MODE_VALUES = new Set(Object.values(WORK_MODE))
const EMPLOYMENT_TYPE_VALUES = new Set(Object.values(EMPLOYMENT_TYPE))
const SORT_VALUES = new Set(Object.values(JOB_DISCOVERY_SORT))
const AMOUNT_PATTERN = /^\d+$/

// Category and Location selections share the backend branch encoding
// `<parent>[:<child>|<child>...]` joined by `;`; an empty child list selects the whole parent.
function parseBranches(value) {
  if (!value) {
    return []
  }

  return value
    .split(';')
    .map((branch) => {
      const [id = '', children = ''] = branch.split(':')
      return { id: id.trim(), childIds: children.split('|').map((child) => child.trim()).filter(Boolean) }
    })
    .filter((branch) => branch.id)
}

function serializeBranches(branches) {
  return branches
    .map(({ id, childIds }) => (childIds.length > 0 ? `${id}:${childIds.join('|')}` : id))
    .join(';')
}

function parseList(value, allowedValues) {
  if (!value) {
    return []
  }

  const items = value.split(',').map((item) => item.trim()).filter(Boolean)
  return allowedValues ? items.filter((item) => allowedValues.has(item)) : items
}

function parseSalary(searchParams) {
  const period = searchParams.get(SEARCH_PARAM.SALARY_PERIOD)
  const min = searchParams.get(SEARCH_PARAM.SALARY_MIN)
  const max = searchParams.get(SEARCH_PARAM.SALARY_MAX)

  if (
    !FILTERABLE_SALARY_PERIODS.includes(period) ||
    !AMOUNT_PATTERN.test(min ?? '') ||
    !AMOUNT_PATTERN.test(max ?? '') ||
    Number(min) > Number(max)
  ) {
    return null
  }

  return { period, min: Number(min), max: Number(max) }
}

function parseJobSearch(searchParams) {
  const page = Number(searchParams.get(SEARCH_PARAM.PAGE))
  const sort = searchParams.get(SEARCH_PARAM.SORT)

  return {
    keyword: searchParams.get(SEARCH_PARAM.KEYWORD)?.trim() ?? '',
    categories: parseBranches(searchParams.get(SEARCH_PARAM.CATEGORIES)),
    locations: parseBranches(searchParams.get(SEARCH_PARAM.LOCATIONS)),
    workModes: parseList(searchParams.get(SEARCH_PARAM.WORK_MODES), WORK_MODE_VALUES),
    employmentTypes: parseList(searchParams.get(SEARCH_PARAM.EMPLOYMENT_TYPES), EMPLOYMENT_TYPE_VALUES),
    experienceLevels: parseList(searchParams.get(SEARCH_PARAM.EXPERIENCE_LEVELS)),
    salary: parseSalary(searchParams),
    sort: SORT_VALUES.has(sort) ? sort : null,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  }
}

function toJobSearchParams(search) {
  const entries = [
    [SEARCH_PARAM.KEYWORD, search.keyword],
    [SEARCH_PARAM.CATEGORIES, serializeBranches(search.categories)],
    [SEARCH_PARAM.LOCATIONS, serializeBranches(search.locations)],
    [SEARCH_PARAM.WORK_MODES, search.workModes.join(',')],
    [SEARCH_PARAM.EMPLOYMENT_TYPES, search.employmentTypes.join(',')],
    [SEARCH_PARAM.EXPERIENCE_LEVELS, search.experienceLevels.join(',')],
    [SEARCH_PARAM.SALARY_PERIOD, search.salary?.period],
    [SEARCH_PARAM.SALARY_MIN, search.salary?.min],
    [SEARCH_PARAM.SALARY_MAX, search.salary?.max],
    [SEARCH_PARAM.SORT, search.sort],
    [SEARCH_PARAM.PAGE, search.page > 1 ? search.page : null],
  ]

  return new URLSearchParams(
    entries.filter(([, value]) => value != null && value !== '').map(([key, value]) => [key, String(value)]),
  )
}

function toDiscoveryJobsQuery(search, limit) {
  const optional = (value) => value || undefined

  return {
    keyword: optional(search.keyword),
    categories: optional(serializeBranches(search.categories)),
    locations: optional(serializeBranches(search.locations)),
    workModes: optional(search.workModes.join(',')),
    employmentTypes: optional(search.employmentTypes.join(',')),
    experienceLevels: optional(search.experienceLevels.join(',')),
    salaryPeriod: search.salary?.period,
    salaryMin: search.salary?.min,
    salaryMax: search.salary?.max,
    sort: search.sort ?? undefined,
    page: search.page,
    limit,
  }
}

export {
  FILTERABLE_SALARY_PERIODS,
  JOB_DISCOVERY_SORT,
  parseJobSearch,
  toDiscoveryJobsQuery,
  toJobSearchParams,
}
