import { z } from 'zod'

import { ACCOUNT_FIELD_LIMIT, VALIDATION_MESSAGE } from '@/utils/constant'

import { accountValidators } from './account.validators'

// confirmPassword is a client-only check; only currentPassword and password are submitted.
const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: VALIDATION_MESSAGE.REQUIRED })
      .min(1, VALIDATION_MESSAGE.REQUIRED)
      .max(ACCOUNT_FIELD_LIMIT.PASSWORD_MAX_LENGTH, VALIDATION_MESSAGE.PASSWORD_LENGTH),
    password: accountValidators.password(),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: VALIDATION_MESSAGE.PASSWORD_MISMATCH,
    path: ['confirmPassword'],
  })

export { changePasswordSchema }
