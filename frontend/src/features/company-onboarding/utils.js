const COMPANY_PROFILE_FIELDS = Object.freeze([
  'name',
  'businessRegistrationNumber',
  'website',
  'address',
  'contactInfo',
  'description',
  'logoUrl',
  'bannerUrl',
])

function toCompanyProfileFormValues(company) {
  return Object.fromEntries(
    COMPANY_PROFILE_FIELDS.map((field) => [field, company?.[field] ?? '']),
  )
}

export { COMPANY_PROFILE_FIELDS, toCompanyProfileFormValues }
