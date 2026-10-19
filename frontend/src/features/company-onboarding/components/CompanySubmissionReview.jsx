import { ArrowLeft, CircleCheck, Clock, LoaderCircle, Send, TriangleAlert } from 'lucide-react'
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
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">
              Trạng thái: Chưa gửi xét duyệt
            </span>
            <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">
              Chưa hoạt động
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Xác nhận gửi hồ sơ xét duyệt
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Kiểm tra lại toàn bộ thông tin doanh nghiệp trước khi gửi. Nội dung hiện tại sẽ
            được chốt thành hồ sơ xét duyệt.
          </p>
        </div>

        <CompanyProfileCard
          badge={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card/95 px-2.5 py-1 text-xs font-semibold text-primary">
              <CircleCheck aria-hidden="true" className="size-3.5" />
              Hồ sơ sẵn sàng
            </span>
          }
          profile={company}
        />
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-5">
          <p className="flex items-center gap-2 font-semibold text-warning-foreground">
            <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-warning" />
            Thông tin sẽ được chốt sau khi gửi
          </p>
          <p className="mt-2 text-sm text-warning-foreground/90">
            Sau khi gửi, JOBHUB dùng đúng bản thông tin này làm hồ sơ xét duyệt. Bạn sẽ không
            thể chỉnh sửa hồ sơ trong thời gian chờ xét duyệt.
          </p>
          <p className="mt-3 rounded-lg bg-warning/15 px-3 py-2 text-xs font-medium text-warning-foreground">
            Mỗi doanh nghiệp chỉ được gửi hồ sơ một lần trong quy trình onboarding.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <p className="flex items-center gap-2 font-semibold">
            <Clock aria-hidden="true" className="size-5 text-primary" />
            Lưu ý xét duyệt
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Sau khi gửi, hồ sơ chờ Platform Admin xét duyệt. Khi được chấp thuận, bạn sẽ nhận
            email chứa liên kết kích hoạt tài khoản và doanh nghiệp.
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-primary">
            <CircleCheck aria-hidden="true" className="size-3.5" />
            Bạn có thể đăng xuất trong thời gian chờ xét duyệt.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border bg-card p-5">
          <label className="flex items-start gap-3 text-sm" htmlFor={confirmId}>
            <input
              checked={confirmed}
              className="mt-0.5 size-4 shrink-0 accent-primary"
              id={confirmId}
              onChange={(event) => setConfirmed(event.target.checked)}
              type="checkbox"
            />
            Tôi đã kiểm tra lại thông tin và muốn gửi hồ sơ xét duyệt.
          </label>
          <Button
            className="h-11 w-full"
            disabled={!confirmed || submitting}
            onClick={handleSubmit}
            type="button"
          >
            {submitting ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Send aria-hidden="true" className="size-4" />
            )}
            Gửi xét duyệt
          </Button>
          <Button
            className="h-11 w-full"
            disabled={submitting}
            onClick={onEdit}
            type="button"
            variant="outline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Quay lại chỉnh sửa
          </Button>
        </div>

        {accountPanel}
      </aside>
    </div>
  )
}

export default CompanySubmissionReview
