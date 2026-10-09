import { z } from 'zod'

const requiredText = (message = 'Trường này là bắt buộc.') =>
  z.string({ error: message }).trim().min(1, message)

const email = (message = 'Email không hợp lệ.') =>
  z.string({ error: message }).trim().pipe(z.email(message))

const validators = Object.freeze({
  requiredText,
  email,
})

export { validators }
