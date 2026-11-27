import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  getCompanyRecruiterApi,
  resendRecruiterActivationApi,
  resetCompanyRecruiterPasswordApi,
  unlockCompanyRecruiterApi,
} from '@/apis/company-recruiter.api'
import { ErrorState, ListSkeleton } from '@/components/common/ListStates'
import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import {
  ConfirmDialog,
  useResource,
} from '@/features/recruiter-workspace/public'
import { COMPANY_MEMBER_STATUS, USER_STATUS } from '@/utils/constant'

import { companyErrorMessage, recruiterReadiness } from '../utils'
import RecruiterForm from './RecruiterForm'

const actions = {
  resend: {
    label: 'Gửi lại email kích hoạt',
    description:
      'Hướng dẫn kích hoạt mới được gửi trực tiếp tới Recruiter; liên kết trước không còn dùng được.',
    api: resendRecruiterActivationApi,
  },
  reset: {
    label: 'Gửi email đặt lại mật khẩu',
    description:
      'Recruiter tự chọn mật khẩu mới. Phiên cũ bị thu hồi khi reset hoàn tất; trạng thái khóa không thay đổi.',
    api: resetCompanyRecruiterPasswordApi,
  },
  unlock: {
    label: 'Mở khóa tại công ty',
    description:
      'Membership trở về ACTIVE nếu mọi điều kiện đều hợp lệ. Không khôi phục phiên đăng nhập cũ hoặc vượt qua khóa nền tảng.',
    api: unlockCompanyRecruiterApi,
  },
}

function CompanyRecruiterDetail({ recruiterId }) {
  const { data, loading, refreshing, error, reload } = useResource(
    getCompanyRecruiterApi,
    recruiterId,
  )
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  if (loading) return <ListSkeleton label="Đang tải Recruiter" />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const recruiter = data.recruiter
  const terminated =
    recruiter.membership.status === COMPANY_MEMBER_STATUS.TERMINATED
  const copy = actions[pending]
  const confirm = async () => {
    setBusy(true)
    setFeedback(null)
    try {
      await copy.api(recruiter.id)
      setFeedback({ message: `Đã thực hiện: ${copy.label.toLowerCase()}.` })
    } catch (failure) {
      setFeedback({ error: true, message: companyErrorMessage(failure) })
    } finally {
      setBusy(false)
      setPending(null)
      reload()
    }
  }
  return (
    <div className="space-y-5">
      <Link
        className="text-sm text-primary hover:underline"
        to="/company/recruiters"
      >
        ← Danh sách Recruiter
      </Link>
      <PageHeader
        description={recruiterReadiness(recruiter)}
        title={recruiter.fullName}
      />
      <dl className="grid gap-4 rounded-xl border bg-card p-5 text-sm sm:grid-cols-2">
        {[
          ['Email', recruiter.email],
          ['Tài khoản nền tảng', recruiter.status],
          ['Membership tại công ty', recruiter.membership.status],
          [
            'Thiết lập mật khẩu',
            recruiter.mustChangePassword ? 'Chưa hoàn tất' : 'Đã hoàn tất',
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-all">{value}</dd>
          </div>
        ))}
      </dl>
      {!terminated ? (
        <RecruiterForm
          key={recruiter.id}
          onSaved={reload}
          recruiter={recruiter}
        />
      ) : (
        <p className="text-sm">
          Tư cách Recruiter đã chấm dứt vĩnh viễn. Mã nhân viên:{' '}
          {recruiter.membership.employeeCode} · Chức danh:{' '}
          {recruiter.membership.jobTitle}. Danh tính và lịch sử được giữ lại.
        </p>
      )}
      {!terminated && (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Quản lý truy cập</h2>
          <div className="flex flex-wrap gap-3">
            {recruiter.mustChangePassword ? (
              <Button
                disabled={
                  busy || refreshing || recruiter.status !== USER_STATUS.ACTIVE
                }
                onClick={() => setPending('resend')}
                variant="outline"
              >
                Gửi lại email kích hoạt
              </Button>
            ) : (
              <Button
                disabled={busy || refreshing}
                onClick={() => setPending('reset')}
                variant="outline"
              >
                Gửi email đặt lại mật khẩu
              </Button>
            )}
            {recruiter.membership.status === COMPANY_MEMBER_STATUS.LOCKED ? (
              <Button
                disabled={
                  busy || refreshing || recruiter.status !== USER_STATUS.ACTIVE
                }
                onClick={() => setPending('unlock')}
                variant="outline"
              >
                Mở khóa tại công ty
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link
                  to={`/company/recruiters/${recruiter.id}/handover?intent=lock`}
                >
                  Khóa Recruiter
                </Link>
              </Button>
            )}
            <Button asChild className="text-destructive" variant="outline">
              <Link
                to={`/company/recruiters/${recruiter.id}/handover?intent=terminate`}
              >
                Chấm dứt tư cách Recruiter
              </Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Khóa hoặc chấm dứt cần kiểm tra bàn giao. Khóa cấp nền tảng có ưu
            tiên cao hơn membership tại công ty.
          </p>
        </section>
      )}
      {feedback && (
        <p
          className={
            feedback.error
              ? 'text-sm text-destructive'
              : 'text-sm text-success-foreground'
          }
          role={feedback.error ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      )}
      <ConfirmDialog
        busy={busy}
        confirmDisabled={refreshing}
        confirmLabel={copy?.label}
        description={copy?.description}
        onCancel={() => setPending(null)}
        onConfirm={confirm}
        open={Boolean(copy)}
        title={copy?.label}
      />
    </div>
  )
}

export default CompanyRecruiterDetail
