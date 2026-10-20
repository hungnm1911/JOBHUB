import { z } from 'zod'

import { VALIDATION_MESSAGE } from '@/utils/constant'

import { accountValidators } from './account.validators'
import { validators } from './common.validators'

// Shared by Candidate and Company Manager registration, whose backend contracts
// both accept exactly fullName, email, and password. confirmPassword is a
// client-only check and is never submitted.
const accountRegistrationSchema = z
  .object({
    fullName: accountValidators.fullName(),
    email: validators.email(),
    password: accountValidators.password(),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: VALIDATION_MESSAGE.PASSWORD_MISMATCH,
    path: ['confirmPassword'],
  })

export { accountRegistrationSchema }
