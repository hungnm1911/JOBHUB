import { z } from 'zod'

import { ACCOUNT_FIELD_LIMIT, VALIDATION_MESSAGE } from '@/utils/constant'

// The V1 password policy forbids trimming or transforming password whitespace.
const password = () =>
  z
    .string({ error: VALIDATION_MESSAGE.REQUIRED })
    .min(1, VALIDATION_MESSAGE.REQUIRED)
    .min(ACCOUNT_FIELD_LIMIT.PASSWORD_MIN_LENGTH, VALIDATION_MESSAGE.PASSWORD_LENGTH)
    .max(ACCOUNT_FIELD_LIMIT.PASSWORD_MAX_LENGTH, VALIDATION_MESSAGE.PASSWORD_LENGTH)

const fullName = () =>
  z
    .string({ error: VALIDATION_MESSAGE.REQUIRED })
    .trim()
    .min(1, VALIDATION_MESSAGE.REQUIRED)
    .max(ACCOUNT_FIELD_LIMIT.FULL_NAME_MAX_LENGTH, VALIDATION_MESSAGE.FULL_NAME_TOO_LONG)

const accountValidators = Object.freeze({
  password,
  fullName,
})

export { accountValidators }
