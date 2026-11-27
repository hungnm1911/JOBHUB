import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { accountRegistrationSchema } from './account-registration.schema'
import { changePasswordSchema } from './authentication-change-password.schema'
import { forgotPasswordSchema } from './authentication-forgot-password.schema'
import { loginSchema } from './authentication-login.schema'
import { resetPasswordSchema } from './authentication-reset-password.schema'
import { validators } from './common.validators'
import {
  companyActiveSchema,
  companyDraftSchema,
  companySubmissionSchema,
} from './company-profile.schema'
import {
  companyRecruiterCreateSchema,
  companyRecruiterMetadataSchema,
} from './company-recruiter.schema'

export {
  accountRegistrationSchema,
  changePasswordSchema,
  companyDraftSchema,
  companyActiveSchema,
  companyRecruiterCreateSchema,
  companyRecruiterMetadataSchema,
  companySubmissionSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  validators,
  z,
  zodResolver,
}
