import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { submitOwnedCompanyApi } from '@/apis/company.api'
import CompanyProfileCard from '@/components/common/CompanyProfileCard'
import { Button } from '@/components/ui/button'
import { API_ERROR_MESSAGE } from '@/utils/constant'

function CompanySubmissionReview({ company, accountPanel, onEdit, onSubmitted, onFieldRejected, onStateChanged }) {
  const confirmId = useId()
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    let result

    try {
      result = await submitOwnedCompanyApi()
    } catch (error) {
      const field = error.details?.field
      setSubmitting(false)

      if (error.status === 409 && field === 'businessRegistrationNumber') {
        onFieldRejected({ field, message: API_ERROR_MESSAGE.BUSINESS_REGISTRATION_NUMBER_TAKEN })
      } else if (error.status === 400 && ['name', 'businessRegistrationNumber'].includes(field)) {
        onFieldRejected({ field, message: error.message })
      } else if (error.status === 409 && field === 'approvalStatus') {
        onStateChanged()
      } else {
        toast.error(error.message)
      }
      return
    }

    onSubmitted(result.company)
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl leading-8 font-semibold tracking-tight [overflow-wrap:anywhere]">
          Xác nhận gửi hồ sơ xét duyệt
        </h1>
        <p className="mt-3 max-w-[64ch] text-sm leading-6 text-pretty text-muted-foreground">
          Kiểm tra lại toàn bộ thông tin doanh nghiệp trước khi gửi. Nội dung hiện tại sẽ
          được chốt thành hồ sơ xét duyệt.
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[0.8125rem] leading-5">
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-muted-foreground">Hồ sơ:</dt>
            <dd>Chưa gửi xét duyệt</dd>
          </div>
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-muted-foreground">Doanh nghiệp:</dt>
            <dd>Chưa hoạt động</dd>
          </div>
        </dl>
      </header>

      <div className="min-w-0 overflow-clip rounded-lg border bg-card">
        <CompanyProfileCard
          badge={<p>Hồ sơ sẵn sàng</p>}
          presentation="review"
          profile={company}
        />

        <div className="border-t bg-secondary/35 px-5 py-6 sm:px-6 md:px-10 md:py-8">
          <section className="max-w-[75ch] space-y-2">
            <h2 className="text-base leading-6 font-semibold">
              Lưu ý xét duyệt
            </h2>
            <p className="text-sm leading-6 text-pretty">
              Sau khi gửi, hồ sơ chờ Platform Admin xét duyệt. Khi được chấp thuận, bạn sẽ nhận
              email chứa liên kết kích hoạt tài khoản và doanh nghiệp.
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Bạn có thể đăng xuất trong thời gian chờ xét duyệt.
            </p>
          </section>

          <section aria-labelledby={`${confirmId}-warning-title`} className="mt-6">
            <div
              className="flex items-start gap-3 rounded-md bg-[color-mix(in_srgb,var(--warning)_10%,var(--card))] p-4 text-warning-foreground"
              id={`${confirmId}-warning`}
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 space-y-2">
                <h2 className="text-[0.9375rem] leading-6 font-semibold" id={`${confirmId}-warning-title`}>
                  Thông tin sẽ được chốt sau khi gửi
                </h2>
                <p className="max-w-[80ch] text-sm leading-6">
                  Sau khi gửi, JOBHUB dùng đúng bản thông tin này làm hồ sơ xét duyệt. Bạn sẽ không
                  thể chỉnh sửa hồ sơ trong thời gian chờ xét duyệt.
                </p>
                <p className="text-sm leading-6 font-medium">
                  Mỗi doanh nghiệp chỉ được gửi hồ sơ một lần trong quy trình onboarding.
                </p>
              </div>
            </div>
            <label className="mt-5 flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm leading-6" htmlFor={confirmId}>
              <input
                aria-describedby={`${confirmId}-warning`}
                checked={confirmed}
                className="mt-1 size-4 shrink-0 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                id={confirmId}
                onChange={(event) => setConfirmed(event.target.checked)}
                type="checkbox"
              />
              Tôi đã kiểm tra lại thông tin và muốn gửi hồ sơ xét duyệt.
            </label>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                className="h-auto min-h-11 w-full px-4 py-2.5 whitespace-normal shadow-none sm:w-auto"
                disabled={submitting}
                onClick={onEdit}
                type="button"
                variant="outline"
              >
                Quay lại chỉnh sửa
              </Button>
              <Button
                className="h-auto min-h-11 w-full px-4 py-2.5 whitespace-normal shadow-none sm:w-auto"
                disabled={!confirmed || submitting}
                onClick={handleSubmit}
                type="button"
              >
                {submitting && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
                Gửi xét duyệt
              </Button>
            </div>
          </section>
        </div>
      </div>

      <aside
        aria-label="Tài khoản đang sử dụng"
        className="max-w-100 [&>div]:rounded-none [&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0"
      >
        {accountPanel}
      </aside>
    </div>
  )
}

export default CompanySubmissionReview
