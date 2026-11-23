import { toRichTextEditorValue, toRichTextPlainText } from '@/lib/rich-text-content'

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
  return {
    ...Object.fromEntries(
      COMPANY_PROFILE_FIELDS.map((field) => [field, company?.[field] ?? '']),
    ),
    descriptionHtml: company?.descriptionHtml ?? '',
  }
}

function toCompanyDescriptionEditorValue(company) {
  return toRichTextEditorValue({ html: company?.descriptionHtml, plainText: company?.description })
}

function toCompanyDescriptionPlainText(html) {
  return toRichTextPlainText(html)
}

function toCompanyProfileUpdatePayload(values, dirtyFields) {
  const profile = { ...values }
  delete profile.description
  delete profile.descriptionHtml
  if (dirtyFields.description || dirtyFields.descriptionHtml) {
    profile.descriptionHtml = values.descriptionHtml
  }
  return profile
}

export {
  COMPANY_PROFILE_FIELDS,
  toCompanyDescriptionEditorValue,
  toCompanyDescriptionPlainText,
  toCompanyProfileFormValues,
  toCompanyProfileUpdatePayload,
}
