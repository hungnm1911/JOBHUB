import { EMPLOYMENT_TYPE_LABEL, WORK_MODE_LABEL } from '@/features/job-discovery/utils'

// Turns a V14 search result into display text. `names` resolves catalog ids and codes.
function toCvSummary(cv, names) {
  const locations = cv.preferredLocations
    .map((location) =>
      [
        names.districts[location.provinceCode]?.[location.districtCode],
        names.provinces.get(location.provinceCode),
      ]
        .filter(Boolean)
        .join(', '),
    )
    .filter(Boolean)

  return {
    cvId: cv.cvId,
    cvName: cv.cvName,
    candidateName: cv.candidateFullName ?? null,
    skills: cv.skillTags,
    facts: [
      { label: 'Danh mục', value: names.categories.get(cv.categoryId) },
      { label: 'Kinh nghiệm', value: names.experience.get(cv.experienceLevelId) },
      { label: 'Địa điểm mong muốn', value: locations.join('; ') },
      {
        label: 'Loại hình',
        value: cv.employmentTypes.map((value) => EMPLOYMENT_TYPE_LABEL[value] ?? value).join(', '),
      },
      {
        label: 'Hình thức',
        value: cv.workModes.map((value) => WORK_MODE_LABEL[value] ?? value).join(', '),
      },
    ].filter((fact) => fact.value),
  }
}

export { toCvSummary }
