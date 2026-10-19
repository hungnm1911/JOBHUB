import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { accountRegistrationSchema } from './account-registration.schema'
import { forgotPasswordSchema } from './authentication-forgot-password.schema'
import { loginSchema } from './authentication-login.schema'
import { resetPasswordSchema } from './authentication-reset-password.schema'
import { validators } from './common.validators'

export {
  accountRegistrationSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  validators,
  z,
  zodResolver,
}
