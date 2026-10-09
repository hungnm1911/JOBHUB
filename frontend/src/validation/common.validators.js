import { z } from 'zod'

import { VALIDATION_MESSAGE } from '@/utils/constant'

const requiredText = (message = VALIDATION_MESSAGE.REQUIRED) =>
  z.string({ error: message }).trim().min(1, message)

const email = (message = VALIDATION_MESSAGE.INVALID_EMAIL) =>
  z.string({ error: message }).trim().pipe(z.email(message))

const validators = Object.freeze({
  requiredText,
  email,
})

export { validators }
