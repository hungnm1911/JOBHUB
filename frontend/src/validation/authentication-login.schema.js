import { z } from 'zod'

import { VALIDATION_MESSAGE } from '@/utils/constant'

import { validators } from './common.validators'

// Login never applies the registration password policy and never trims passwords.
const loginSchema = z.object({
  email: validators.email(),
  password: z
    .string({ error: VALIDATION_MESSAGE.REQUIRED })
    .min(1, VALIDATION_MESSAGE.REQUIRED),
})

export { loginSchema }
