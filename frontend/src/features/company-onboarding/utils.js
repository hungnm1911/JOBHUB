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
  if (company?.descriptionHtml) return company.descriptionHtml
  if (!company?.description) return ''

  const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
  return `<p>${company.description.split(/\r?\n/).map(escapeHtml).join('<br>')}</p>`
}

function toCompanyDescriptionPlainText(html) {
  const template = document.createElement('template')
  template.innerHTML = html
  for (const breakElement of template.content.querySelectorAll('br')) {
    breakElement.replaceWith('\n')
  }
  return [...template.content.children].map((block) => block.textContent).join('\n').trim()
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
