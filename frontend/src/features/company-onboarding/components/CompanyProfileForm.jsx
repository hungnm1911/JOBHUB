import {
  ArrowRight,
  Building2,
  FileBadge,
  Globe,
  LoaderCircle,
  MapPin,
  Phone,
  Save,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { updateOwnedCompanyApi } from '@/apis/company.api'
import { Button } from '@/components/ui/button'
import { API_ERROR_MESSAGE, COMPANY_IMAGE_KIND, COMPANY_PROFILE_LIMIT } from '@/utils/constant'
import { companyDraftSchema, companySubmissionSchema, zodResolver } from '@/validation'

import { COMPANY_PROFILE_FIELDS, toCompanyProfileFormValues } from '../utils'
import CompanyImageField from './CompanyImageField'
import CompanyProfileField from './CompanyProfileField'

const SAVE_INTENT = Object.freeze({
  DRAFT: 'draft',
  CONTINUE: 'continue',
})

const draftResolver = zodResolver(companyDraftSchema)
const submissionResolver = zodResolver(companySubmissionSchema)

function FormSection({ title, description, children }) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function CompanyProfileForm({ company, serverFieldError, onSaved, onContinue, onStateChanged }) {
  const intentRef = useRef(SAVE_INTENT.DRAFT)
  const [pendingIntent, setPendingIntent] = useState(null)
  const {
    control,
    formState: { errors, isSubmitting, isDirty },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
  } = useForm({
    defaultValues: toCompanyProfileFormValues(company),
    resolver: (values, context, options) =>
      (intentRef.current === SAVE_INTENT.CONTINUE ? submissionResolver : draftResolver)(
        values,
        context,
        options,
      ),
  })
  const [logoUrl, bannerUrl, description] = useWatch({
    control,
    name: ['logoUrl', 'bannerUrl', 'description'],
  })

  const assignImageUrl = (field, url) => {
    setValue(field, url, { shouldDirty: true, shouldValidate: true })
  }

  useEffect(() => {
    if (serverFieldError) {
      setError(
        serverFieldError.field,
        { message: serverFieldError.message },
        { shouldFocus: true },
      )
    }
  }, [serverFieldError, setError])

  const save = async (values) => {
    let result

    try {
      result = await updateOwnedCompanyApi(values)
    } catch (error) {
      const field = error.details?.field

      if (error.status === 409 && field === 'businessRegistrationNumber') {
        setError(
          field,
          { message: API_ERROR_MESSAGE.BUSINESS_REGISTRATION_NUMBER_TAKEN },
          { shouldFocus: true },
        )
      } else if (error.status === 400 && COMPANY_PROFILE_FIELDS.includes(field)) {
        setError(field, { message: error.message }, { shouldFocus: true })
      } else if (error.status === 409 && field === 'approvalStatus') {
        onStateChanged()
      } else {
        toast.error(error.message)
      }
      return
    }

    reset(toCompanyProfileFormValues(result.company))

    if (intentRef.current === SAVE_INTENT.CONTINUE) {
      onContinue(result.company)
      return
    }

    toast.success('Đã lưu nháp hồ sơ doanh nghiệp.')
    onSaved(result.company)
  }

  const submitWithIntent = async (intent) => {
    intentRef.current = intent
    setPendingIntent(intent)

    try {
      await handleSubmit(save)()
    } finally {
      setPendingIntent(null)
    }
  }

  const savingIntent = isSubmitting ? pendingIntent : null

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        submitWithIntent(SAVE_INTENT.CONTINUE)
      }}
    >
      <FormSection
        description="Tên doanh nghiệp và mã số doanh nghiệp là bắt buộc khi gửi xét duyệt."
        title="Thông tin pháp lý"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CompanyProfileField
            error={errors.name}
            icon={Building2}
            inputProps={{
              autoComplete: 'organization',
              placeholder: 'Công ty Cổ phần ABC',
              ...register('name'),
            }}
            label="Tên doanh nghiệp"
            required
          />
          <CompanyProfileField
            error={errors.businessRegistrationNumber}
            hint="Mỗi mã số doanh nghiệp chỉ được dùng cho một doanh nghiệp."
            icon={FileBadge}
            inputProps={{
              placeholder: '0109876543',
              ...register('businessRegistrationNumber'),
            }}
            label="Mã số doanh nghiệp"
            required
          />
        </div>
      </FormSection>

      <FormSection title="Liên hệ">
        <div className="grid gap-4 sm:grid-cols-2">
          <CompanyProfileField
            error={errors.website}
            icon={Globe}
            inputProps={{
              inputMode: 'url',
              placeholder: 'https://abc-tech.vn',
              ...register('website'),
            }}
            label="Website"
          />
          <CompanyProfileField
            error={errors.contactInfo}
            icon={Phone}
            inputProps={{
              placeholder: 'Email: hr@abc-tech.vn – Hotline: 024…',
              ...register('contactInfo'),
            }}
            label="Thông tin liên hệ"
          />
          <CompanyProfileField
            className="sm:col-span-2"
            error={errors.address}
            icon={MapPin}
            inputProps={{
              autoComplete: 'street-address',
              placeholder: 'Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố',
              ...register('address'),
            }}
            label="Địa chỉ"
          />
        </div>
      </FormSection>

      <FormSection title="Giới thiệu doanh nghiệp">
        <CompanyProfileField
          error={errors.description}
          hint={`${description?.length ?? 0}/${COMPANY_PROFILE_LIMIT.DESCRIPTION_MAX_LENGTH} ký tự`}
          inputProps={{
            placeholder: 'Lĩnh vực hoạt động, sản phẩm, văn hóa doanh nghiệp…',
            rows: 6,
            ...register('description'),
          }}
          label="Mô tả doanh nghiệp"
          multiline
        />
      </FormSection>

      <FormSection
        description="Chọn ảnh từ máy. JOBHUB tải lên và gắn vào hồ sơ khi bạn lưu nháp hoặc tiếp tục."
        title="Hình ảnh thương hiệu"
      >
        <input type="hidden" {...register('logoUrl')} />
        <input type="hidden" {...register('bannerUrl')} />
        <div className="grid gap-5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-start sm:gap-6">
          <CompanyImageField
            disabled={isSubmitting}
            error={errors.logoUrl}
            frameClassName="aspect-square"
            kind={COMPANY_IMAGE_KIND.LOGO}
            label="Logo"
            onCleared={() => assignImageUrl('logoUrl', '')}
            onUploaded={(url) => assignImageUrl('logoUrl', url)}
            value={logoUrl?.trim()}
          />
          <CompanyImageField
            disabled={isSubmitting}
            error={errors.bannerUrl}
            frameClassName="aspect-[21/9] min-h-28"
            kind={COMPANY_IMAGE_KIND.BANNER}
            label="Ảnh bìa"
            onCleared={() => assignImageUrl('bannerUrl', '')}
            onUploaded={(url) => assignImageUrl('bannerUrl', url)}
            value={bannerUrl?.trim()}
          />
        </div>
      </FormSection>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          className="h-11"
          disabled={isSubmitting}
          onClick={() => submitWithIntent(SAVE_INTENT.DRAFT)}
          type="button"
          variant="outline"
        >
          {savingIntent === SAVE_INTENT.DRAFT ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Save aria-hidden="true" className="size-4" />
          )}
          Lưu nháp
        </Button>
        <Button className="h-11" disabled={isSubmitting} type="submit">
          {savingIntent === SAVE_INTENT.CONTINUE ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          Tiếp tục kiểm tra hồ sơ
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
      {isDirty && (
        <p className="text-right text-xs text-muted-foreground">Bạn có thay đổi chưa lưu.</p>
      )}
    </form>
  )
}

export default CompanyProfileForm
