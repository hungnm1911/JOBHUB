import { z } from 'zod'

import { validators } from './common.validators'

const forgotPasswordSchema = z.object({
  email: validators.email(),
})

export { forgotPasswordSchema }
