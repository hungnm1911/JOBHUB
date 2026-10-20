import { CircleCheck, CircleX, LoaderCircle, RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { getOwnedCompanyApi } from '@/apis/company.api'
import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import { COMPANY_APPROVAL_STATUS, COMPANY_OPERATIONAL_STATUS } from '@/utils/constant'

import CompanyOnboardingStepper from './CompanyOnboardingStepper'
import CompanyProfileForm from './CompanyProfileForm'
import CompanySubmissionReview from './CompanySubmissionReview'
import CompanySubmittedStatus from './CompanySubmittedStatus'

const PHASE = Object.freeze({
  LOADING: 'loading',
  LOAD_FAILED: 'loadFailed',
  DRAFT: 'draft',
  REVIEW: 'review',
  SUBMITTED: 'submitted',
  ACTIVE: 'active',
})

const PHASE_STEP = Object.freeze({
  [PHASE.DRAFT]: 1,
  [PHASE.REVIEW]: 2,
  [PHASE.SUBMITTED]: 3,
  [PHASE.ACTIVE]: 5,
})

function toPhase(company) {
  if (company.approvalStatus === COMPANY_APPROVAL_STATUS.NOT_SUBMITTED) {
    return PHASE.DRAFT
  }

  if (
    company.approvalStatus === COMPANY_APPROVAL_STATUS.APPROVED &&
    company.operationalStatus === COMPANY_OPERATIONAL_STATUS.ACTIVE
  ) {
    return PHASE.ACTIVE
  }

  return PHASE.SUBMITTED
}

// V02 onboarding access only reads the Company while it is NOT_SUBMITTED; any
// later approval state answers 409 on approvalStatus and is shown as submitted.
function CompanyOnboardingFlow({ accountPanel }) {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({ attempt: -1, phase: PHASE.LOADING, company: null })
  const [serverFieldError, setServerFieldError] = useState(null)
  const phase = view.attempt === loadAttempt ? view.phase : PHASE.LOADING

  useEffect(() => {
    let active = true

    getOwnedCompanyApi().then(
      ({ company }) => {
        if (active) {
          setView({ attempt: loadAttempt, phase: toPhase(company), company })
        }
      },
      (error) => {
        if (!active) {
          return
        }

        if (error.status === 409 && error.details?.field === 'approvalStatus') {
          setView({ attempt: loadAttempt, phase: PHASE.SUBMITTED, company: null })
        } else {
          setView({ attempt: loadAttempt, phase: PHASE.LOAD_FAILED, company: null, error })
        }
      },
    )

    return () => {
      active = false
    }
  }, [loadAttempt])

  const reload = () => setLoadAttempt((current) => current + 1)
  const showPhase = (nextPhase, company = view.company) =>
    setView((current) => ({ ...current, phase: nextPhase, company }))

  return (
    <div className="space-y-6">
      {PHASE_STEP[phase] && <CompanyOnboardingStepper currentStep={PHASE_STEP[phase]} />}

      {phase === PHASE.LOADING && (
        <CenteredState
          icon={LoaderCircle}
          spinning
          title="Đang tải hồ sơ doanh nghiệp…"
          tone="bg-primary/10 text-primary"
        />
      )}

      {phase === PHASE.LOAD_FAILED && (
        <CenteredState
          action={
            <Button onClick={reload} type="button">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          }
          description={view.error?.message}
          icon={CircleX}
          title="Không thể tải hồ sơ doanh nghiệp"
          tone="bg-destructive/10 text-destructive"
        />
      )}

      {phase === PHASE.DRAFT && (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Hoàn thiện hồ sơ doanh nghiệp
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Hồ sơ được lưu dưới dạng nháp cho tới khi bạn gửi xét duyệt. Bạn có thể lưu
                nháp và quay lại tiếp tục bất cứ lúc nào.
              </p>
            </div>
            <CompanyProfileForm
              company={view.company}
              onContinue={(company) => {
                setServerFieldError(null)
                showPhase(PHASE.REVIEW, company)
              }}
              onSaved={(company) => showPhase(PHASE.DRAFT, company)}
              onStateChanged={reload}
              serverFieldError={serverFieldError}
            />
          </div>
          <aside className="space-y-4">
            <div className="rounded-2xl border bg-card p-5 text-sm">
              <p className="font-semibold">Điều kiện gửi xét duyệt</p>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                <li className="flex gap-2">
                  <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                  Có tên doanh nghiệp.
                </li>
                <li className="flex gap-2">
                  <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                  Có mã số doanh nghiệp chưa được doanh nghiệp khác sử dụng.
                </li>
              </ul>
            </div>
            {accountPanel}
          </aside>
        </div>
      )}

      {phase === PHASE.REVIEW && (
        <CompanySubmissionReview
          accountPanel={accountPanel}
          company={view.company}
          onEdit={() => showPhase(PHASE.DRAFT)}
          onFieldRejected={(fieldError) => {
            setServerFieldError(fieldError)
            showPhase(PHASE.DRAFT)
          }}
          onStateChanged={reload}
          onSubmitted={(company) => showPhase(PHASE.SUBMITTED, company)}
        />
      )}

      {phase === PHASE.SUBMITTED && (
        <CompanySubmittedStatus accountPanel={accountPanel} company={view.company} />
      )}

      {phase === PHASE.ACTIVE && (
        <CenteredState
          action={
            <Button asChild>
              <Link replace to="/">
                Về trang chủ
              </Link>
            </Button>
          }
          description="Tài khoản Company Manager và doanh nghiệp của bạn đã được kích hoạt."
          icon={CircleCheck}
          title="Onboarding đã hoàn tất"
          tone="bg-primary text-primary-foreground"
        />
      )}
    </div>
  )
}

export default CompanyOnboardingFlow
