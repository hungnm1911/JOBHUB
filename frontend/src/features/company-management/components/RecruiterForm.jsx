import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

import {
  createCompanyRecruiterApi,
  updateCompanyRecruiterApi,
} from '@/apis/company-recruiter.api'
import useUnsavedChangesPrompt from '@/components/common/UnsavedChangesProvider/hooks/useUnsavedChangesPrompt'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'
import {
  companyRecruiterCreateSchema,
  companyRecruiterMetadataSchema,
  zodResolver,
} from '@/validation'

import { companyErrorMessage } from '../utils'

const fields = [
  { name: 'fullName', label: 'Họ và tên', type: 'text' },
  { name: 'email', label: 'Email công việc', type: 'email' },
  { name: 'employeeCode', label: 'Mã nhân viên', type: 'text' },
  { name: 'jobTitle', label: 'Chức danh', type: 'text' },
]

function RecruiterForm({ recruiter, onSaved }) {
  const creating = !recruiter
  const defaults = creating
    ? { fullName: '', email: '', employeeCode: '', jobTitle: '' }
    : {
        employeeCode: recruiter.membership.employeeCode,
        jobTitle: recruiter.membership.jobTitle,
      }
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm({
    defaultValues: defaults,
    resolver: zodResolver(
      creating ? companyRecruiterCreateSchema : companyRecruiterMetadataSchema,
    ),
  })
  const { markSaved } = useUnsavedChangesPrompt(isDirty)
  const [failure, setFailure] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [success, setSuccess] = useState('')
  const save = async (values) => {
    setFailure('')
    setSuccess('')
    try {
      const result = creating
        ? await createCompanyRecruiterApi(values)
        : await updateCompanyRecruiterApi(recruiter.id, values)
      markSaved()
      reset(values)
      setSuccess(
        creating
          ? 'Đã tạo Recruiter và gửi email kích hoạt.'
          : 'Đã lưu thông tin nhân viên.',
      )
      onSaved?.(result.recruiter)
    } catch (error) {
      const field = error.details?.field
      if (
        [400, 409].includes(error.status) &&
        fields.some((item) => item.name === field)
      ) {
        setError(
          field,
          {
            message:
              error.status === 409
                ? field === 'email'
                  ? 'Email này đã được đăng ký.'
                  : 'Mã nhân viên đã có trong công ty, kể cả nhân viên đã chấm dứt.'
                : 'Giá trị không hợp lệ.',
          },
          { shouldFocus: true },
        )
      } else {
        setFailure(companyErrorMessage(error))
        if (creating && error.status === 503) setUncertain(true)
      }
    }
  }
  return (
    <form
      className="space-y-5 rounded-xl border bg-card p-5 sm:p-6"
      noValidate
      onSubmit={handleSubmit(save)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {fields
          .filter(
            (item) => creating || !['fullName', 'email'].includes(item.name),
          )
          .map((field) => (
            <div className="space-y-1.5" key={field.name}>
              <label
                className="text-sm font-medium"
                htmlFor={`cm-${field.name}`}
              >
                {field.label}
              </label>
              <Input
                aria-describedby={
                  errors[field.name] ? `cm-${field.name}-error` : undefined
                }
                aria-invalid={Boolean(errors[field.name])}
                disabled={isSubmitting}
                id={`cm-${field.name}`}
                maxLength={field.name === 'email' ? 320 : 100}
                type={field.type}
                {...register(field.name)}
              />
              {errors[field.name] && (
                <p
                  className="text-sm text-destructive"
                  id={`cm-${field.name}-error`}
                  role="alert"
                >
                  {errors[field.name].message}
                </p>
              )}
            </div>
          ))}
      </div>
      {creating && (
        <p className="text-sm text-muted-foreground">
          Recruiter nhận email và tự thiết lập mật khẩu. Manager không chọn hoặc
          xem mật khẩu của họ.
        </p>
      )}
      {failure && (
        <p className="text-sm text-destructive" role="alert">
          {failure}
        </p>
      )}
      {success && (
        <p className="text-sm text-success-foreground" role="status">
          {success}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          aria-busy={isSubmitting}
          disabled={isSubmitting || uncertain}
          type="submit"
        >
          {isSubmitting
            ? 'Đang lưu…'
            : creating
              ? 'Tạo và gửi email kích hoạt'
              : 'Lưu thông tin nhân viên'}
        </Button>
        {creating && (
          <Button asChild variant="outline">
            <Link to="/company/recruiters">
              {uncertain
                ? 'Kiểm tra danh sách Recruiter'
                : 'Quay lại danh sách'}
            </Link>
          </Button>
        )}
      </div>
    </form>
  )
}

export default RecruiterForm
