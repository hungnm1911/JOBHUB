import { z } from 'zod'

import { validators } from './common.validators'

const employeeText = validators.requiredText().max(100, 'Tối đa 100 ký tự.')
const companyRecruiterMetadataSchema = z.object({
  employeeCode: employeeText,
  jobTitle: employeeText,
})
const companyRecruiterCreateSchema = companyRecruiterMetadataSchema.extend({
  fullName: employeeText,
  email: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập email.')
    .max(320)
    .email('Email không hợp lệ.'),
})

export { companyRecruiterCreateSchema, companyRecruiterMetadataSchema }
