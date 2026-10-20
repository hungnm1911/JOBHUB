import { z } from 'zod'

import { VALIDATION_MESSAGE } from '@/utils/constant'

import { accountValidators } from './account.validators'

// confirmPassword is a client-only check; only token and password are submitted.
const resetPasswordSchema = z
  .object({
    password: accountValidators.password(),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: VALIDATION_MESSAGE.PASSWORD_MISMATCH,
    path: ['confirmPassword'],
  })

export { resetPasswordSchema }
