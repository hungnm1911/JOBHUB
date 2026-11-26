import { EMPLOYMENT_TYPE, WORK_MODE } from '@/utils/constant'

const SEARCH_PAGE_SIZE = 20
const SORT = Object.freeze({ NEWEST: '-updatedAt', OLDEST: 'updatedAt' })

const ID_PATTERN = /^[a-fA-F0-9]{24}$/
const CODE_PATTERN = /^[\w-]{1,20}$/

const readList = (params, key, accept) => params.getAll(key).filter(accept)

// Hierarchy selections are stored as `parent[:child|child]` branches joined by `;`.
function parseBranches(value, accept) {
  return (value ?? '')
    .split(';')
    .map((branch) => {
      const [id = '', children = ''] = branch.split(':')
      return { id, childIds: children.split('|').filter((child) => accept.test(child)) }
    })
    .filter((branch) => accept.test(branch.id))
}

const serializeBranches = (branches) =>
  branches
    .map(({ id, childIds }) => (childIds.length ? `${id}:${childIds.join('|')}` : id))
    .join(';')

function readCandidateSearch(params) {
  const page = params.get('page') ?? ''
  return {
    keyword: (params.get('keyword') ?? '').slice(0, 200),
    categories: parseBranches(params.get('categories'), ID_PATTERN),
    locations: parseBranches(params.get('locations'), CODE_PATTERN),
    experienceLevelIds: readList(params, 'experience', (value) => ID_PATTERN.test(value)),
    skillTags: readList(params, 'skill', (value) => value.trim() !== '' && value.length <= 100),
    employmentTypes: readList(params, 'type', (value) => value in EMPLOYMENT_TYPE),
    workModes: readList(params, 'mode', (value) => value in WORK_MODE),
    sort: params.get('sort') === SORT.OLDEST ? SORT.OLDEST : SORT.NEWEST,
    page: /^[1-9]\d{0,5}$/.test(page) ? Number(page) : 1,
  }
}

function toCandidateSearchParams(search) {
  const params = new URLSearchParams()
  if (search.keyword) params.set('keyword', search.keyword)
  if (search.categories.length) params.set('categories', serializeBranches(search.categories))
  if (search.locations.length) params.set('locations', serializeBranches(search.locations))
  for (const value of search.experienceLevelIds) params.append('experience', value)
  for (const value of search.skillTags) params.append('skill', value)
  for (const value of search.employmentTypes) params.append('type', value)
  for (const value of search.workModes) params.append('mode', value)
  if (search.sort !== SORT.NEWEST) params.set('sort', search.sort)
  if (search.page > 1) params.set('page', String(search.page))
  return params
}

// The exact V14 query. `q` is rejected by the backend, so only `keyword` is sent.
function toCandidateSearchQuery(search) {
  const query = new URLSearchParams({
    page: String(search.page),
    limit: String(SEARCH_PAGE_SIZE),
    sort: search.sort,
  })
  if (search.keyword.trim()) query.set('keyword', search.keyword.trim())
  // A chosen Field without Positions filters the whole Field.
  for (const branch of search.categories) {
    for (const id of branch.childIds.length ? branch.childIds : [branch.id]) {
      query.append('categoryIds', id)
    }
  }
  if (search.locations.length) query.set('preferredLocations', serializeBranches(search.locations))
  for (const value of search.experienceLevelIds) query.append('experienceLevelIds', value)
  for (const value of search.skillTags) query.append('skillTags', value)
  for (const value of search.employmentTypes) query.append('employmentTypes', value)
  for (const value of search.workModes) query.append('workModes', value)
  return query.toString()
}

export {
  SORT,
  readCandidateSearch,
  toCandidateSearchParams,
  toCandidateSearchQuery,
}
