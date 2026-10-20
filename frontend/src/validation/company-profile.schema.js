import { z } from 'zod'

import { COMPANY_PROFILE_LIMIT, VALIDATION_MESSAGE } from '@/utils/constant'

import { validators } from './common.validators'

const optionalText = (maxLength) =>
  z.string().trim().max(maxLength, VALIDATION_MESSAGE.MAX_LENGTH(maxLength))

const requiredText = (maxLength) =>
  validators.requiredText().max(maxLength, VALIDATION_MESSAGE.MAX_LENGTH(maxLength))

// Draft saves accept any subset of the V02 profile; empty strings are stored as
// null by the backend.
const companyDraftSchema = z.object({
  name: optionalText(COMPANY_PROFILE_LIMIT.NAME_MAX_LENGTH),
  businessRegistrationNumber: optionalText(
    COMPANY_PROFILE_LIMIT.BUSINESS_REGISTRATION_NUMBER_MAX_LENGTH,
  ),
  website: optionalText(COMPANY_PROFILE_LIMIT.URL_MAX_LENGTH),
  address: optionalText(COMPANY_PROFILE_LIMIT.ADDRESS_MAX_LENGTH),
  contactInfo: optionalText(COMPANY_PROFILE_LIMIT.CONTACT_INFO_MAX_LENGTH),
  description: optionalText(COMPANY_PROFILE_LIMIT.DESCRIPTION_MAX_LENGTH),
  logoUrl: optionalText(COMPANY_PROFILE_LIMIT.URL_MAX_LENGTH),
  bannerUrl: optionalText(COMPANY_PROFILE_LIMIT.URL_MAX_LENGTH),
})

// V02 BR-05: name and businessRegistrationNumber are required to submit.
const companySubmissionSchema = companyDraftSchema.extend({
  name: requiredText(COMPANY_PROFILE_LIMIT.NAME_MAX_LENGTH),
  businessRegistrationNumber: requiredText(
    COMPANY_PROFILE_LIMIT.BUSINESS_REGISTRATION_NUMBER_MAX_LENGTH,
  ),
})

export { companyDraftSchema, companySubmissionSchema }
