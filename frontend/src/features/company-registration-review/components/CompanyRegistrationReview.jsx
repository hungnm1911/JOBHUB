import {
  ArrowLeft,
  Ban,
  CircleCheck,
  CircleX,
  Hourglass,
  LoaderCircle,
  Lock,
  Mail,
  RotateCw,
  SearchX,
  TriangleAlert,
  UserRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import {
  approveCompanyRegistrationApi,
  getCompanyRegistrationApi,
  rejectCompanyRegistrationApi,
} from '@/apis/platform-admin.api'
import CenteredState from '@/components/common/CenteredState'
import CompanyProfileCard from '@/components/common/CompanyProfileCard'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { API_ERROR_MESSAGE, USER_STATUS } from '@/utils/constant'

import { REGISTRATION_STAGE, formatDateTime, toRegistrationStage } from '../utils'
import RegistrationStageBadge from './RegistrationStageBadge'

const DECISION = Object.freeze({
  APPROVE: 'approve',
  REJECT: 'reject',
})

const USER_STATUS_LABEL = Object.freeze({
  [USER_STATUS.PENDING_ACTIVATION]: 'Chờ kích hoạt',
  [USER_STATUS.ACTIVE]: 'Đang hoạt động',
  [USER_STATUS.LOCKED]: 'Đã khóa',
  [USER_STATUS.TERMINATED]: 'Đã chấm dứt',
})

const STAGE_OUTCOME = Object.freeze({
  [REGISTRATION_STAGE.AWAITING_CONFIRMATION]: {
    icon: Hourglass,
    tone: 'border-primary/30 bg-primary/5',
    iconClassName: 'text-primary',
    title: 'Đã phê duyệt, chờ Company Manager kích hoạt',
    description:
      'Email kích hoạt đã được gửi tới Company Manager. Doanh nghiệp chỉ hoạt động sau khi Company Manager mở liên kết kích hoạt; nếu liên kết hết hạn, Company Manager tự yêu cầu gửi lại.',
  },
  [REGISTRATION_STAGE.ACTIVE]: {
    icon: CircleCheck,
    tone: 'border-primary/30 bg-primary/5',
    iconClassName: 'text-primary',
    title: 'Doanh nghiệp đang hoạt động',
    description: 'Company Manager đã kích hoạt tài khoản và doanh nghiệp.',
  },
  [REGISTRATION_STAGE.REJECTED]: {
    icon: Ban,
    tone: 'border-destructive/30 bg-destructive/5',
    iconClassName: 'text-destructive',
    title: 'Hồ sơ đã bị từ chối',
    description: 'Đây là trạng thái cuối cùng. Hồ sơ này không thể được phê duyệt hoặc gửi lại.',
  },
  [REGISTRATION_STAGE.LOCKED]: {
    icon: Lock,
    tone: 'border-destructive/30 bg-destructive/5',
    iconClassName: 'text-destructive',
    title: 'Doanh nghiệp đã bị khóa',
    description: 'Doanh nghiệp không còn hoạt động trên JOBHUB.',
  },
})

function MetaRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value ?? '—'}</dd>
    </div>
  )
}

function DecisionPanel({ registration, onDecided, onStateChanged }) {
  const [confirming, setConfirming] = useState(null)
  const [deciding, setDeciding] = useState(false)

  const decide = async (decision) => {
    const request =
      decision === DECISION.APPROVE ? approveCompanyRegistrationApi : rejectCompanyRegistrationApi
    setDeciding(true)

    try {
      const result = await request(registration.id)
      toast.success(
        decision === DECISION.APPROVE
          ? 'Đã phê duyệt hồ sơ và gửi email kích hoạt tới Company Manager.'
          : 'Đã từ chối hồ sơ doanh nghiệp.',
      )
      onDecided(result.companyRegistration)
    } catch (error) {
      setDeciding(false)
      setConfirming(null)

      if (decision === DECISION.APPROVE && error.status === 503) {
        toast.warning(API_ERROR_MESSAGE.COMPANY_APPROVAL_EMAIL_FAILED)
        onStateChanged()
      } else if (error.status === 409) {
        toast.error(API_ERROR_MESSAGE.COMPANY_REGISTRATION_STATE_CHANGED)
        onStateChanged()
      } else if (error.status === 404) {
        toast.error(API_ERROR_MESSAGE.COMPANY_REGISTRATION_NOT_FOUND)
        onStateChanged()
      } else {
        toast.error(error.message)
      }
    }
  }

  if (confirming === DECISION.APPROVE) {
    return (
      <div className="space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <p className="flex items-center gap-2 font-semibold">
          <CircleCheck aria-hidden="true" className="size-5 text-primary" />
          Xác nhận phê duyệt?
        </p>
        <p className="text-sm text-muted-foreground">
          JOBHUB sẽ gửi email kích hoạt tới{' '}
          <span className="font-semibold text-foreground">{registration.manager?.email}</span>.
          Doanh nghiệp chỉ hoạt động sau khi Company Manager mở liên kết trong email.
        </p>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={deciding}
            onClick={() => setConfirming(null)}
            type="button"
            variant="outline"
          >
            Hủy
          </Button>
          <Button className="flex-1" disabled={deciding} onClick={() => decide(DECISION.APPROVE)} type="button">
            {deciding && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
            Phê duyệt
          </Button>
        </div>
      </div>
    )
  }

  if (confirming === DECISION.REJECT) {
    return (
      <div className="space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <p className="flex items-center gap-2 font-semibold text-destructive">
          <TriangleAlert aria-hidden="true" className="size-5" />
          Xác nhận từ chối?
        </p>
        <p className="text-sm text-muted-foreground">
          Từ chối là quyết định cuối cùng: hồ sơ này sẽ không thể được phê duyệt hoặc gửi lại.
        </p>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={deciding}
            onClick={() => setConfirming(null)}
            type="button"
            variant="outline"
          >
            Hủy
          </Button>
          <Button
            className="flex-1 bg-destructive text-white hover:bg-destructive/90"
            disabled={deciding}
            onClick={() => decide(DECISION.REJECT)}
            type="button"
          >
            {deciding && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
            Từ chối
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      <div>
        <p className="font-semibold">Quyết định xét duyệt</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Kiểm tra hồ sơ đã gửi và thông tin Company Manager trước khi ra quyết định.
        </p>
      </div>
      <Button className="h-11 w-full" onClick={() => setConfirming(DECISION.APPROVE)} type="button">
        <CircleCheck aria-hidden="true" className="size-4" />
        Phê duyệt hồ sơ
      </Button>
      <Button
        className="h-11 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setConfirming(DECISION.REJECT)}
        type="button"
        variant="outline"
      >
        <CircleX aria-hidden="true" className="size-4" />
        Từ chối hồ sơ
      </Button>
    </div>
  )
}

function StageOutcome({ stage }) {
  const outcome = STAGE_OUTCOME[stage]
  const Icon = outcome.icon

  return (
    <div className={cn('space-y-2 rounded-2xl border p-5', outcome.tone)}>
      <p className="flex items-center gap-2 font-semibold">
        <Icon aria-hidden="true" className={cn('size-5', outcome.iconClassName)} />
        {outcome.title}
      </p>
      <p className="text-sm text-muted-foreground">{outcome.description}</p>
    </div>
  )
}

function CompanyRegistrationReview({ companyId, listPath, accountPanel }) {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({ key: null, registration: null, error: null })
  const viewKey = `${companyId}:${loadAttempt}`
  const loading = view.key !== viewKey

  useEffect(() => {
    let active = true

    getCompanyRegistrationApi(companyId).then(
      ({ companyRegistration }) => {
        if (active) {
          setView({ key: viewKey, registration: companyRegistration, error: null })
        }
      },
      (error) => {
        if (active) {
          setView({ key: viewKey, registration: null, error })
        }
      },
    )

    return () => {
      active = false
    }
  }, [companyId, viewKey])

  const reload = () => setLoadAttempt((current) => current + 1)
  const backLink = (
    <Link
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      to={listPath}
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Danh sách hồ sơ
    </Link>
  )

  if (loading) {
    return (
      <div className="space-y-4">
        {backLink}
        <CenteredState
          icon={LoaderCircle}
          spinning
          title="Đang tải hồ sơ doanh nghiệp…"
          tone="bg-primary/10 text-primary"
        />
      </div>
    )
  }

  if (view.error) {
    const notFound = [400, 404].includes(view.error.status)

    return (
      <div className="space-y-4">
        {backLink}
        <CenteredState
          action={
            !notFound && (
              <Button onClick={reload} type="button">
                <RotateCw aria-hidden="true" className="size-4" />
                Thử lại
              </Button>
            )
          }
          description={notFound ? API_ERROR_MESSAGE.COMPANY_REGISTRATION_NOT_FOUND : view.error.message}
          icon={notFound ? SearchX : CircleX}
          title={notFound ? 'Không tìm thấy hồ sơ' : 'Không thể tải hồ sơ doanh nghiệp'}
          tone="bg-destructive/10 text-destructive"
        />
      </div>
    )
  }

  const { registration } = view
  const stage = toRegistrationStage(registration)
  const snapshot = registration.reviewSnapshot ?? {}

  return (
    <div className="space-y-6">
      {backLink}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <div>
            <RegistrationStageBadge stage={stage} />
            <h1 className="mt-3 text-2xl font-bold tracking-tight break-words sm:text-3xl">
              {snapshot.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Nội dung dưới đây là hồ sơ Company Manager đã chốt tại thời điểm gửi xét duyệt.
            </p>
          </div>

          <CompanyProfileCard profile={snapshot} />

          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="flex items-center gap-2 font-semibold">
              <UserRound aria-hidden="true" className="size-5 text-primary" />
              Company Manager
            </p>
            {registration.manager ? (
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-secondary/60 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Họ và tên
                  </dt>
                  <dd className="mt-1.5 text-sm font-medium break-words">
                    {registration.manager.fullName}
                  </dd>
                </div>
                <div className="rounded-xl bg-secondary/60 p-4">
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Mail aria-hidden="true" className="size-3.5" />
                    Email
                  </dt>
                  <dd className="mt-1.5 text-sm font-medium break-all">{registration.manager.email}</dd>
                </div>
                <div className="rounded-xl bg-secondary/60 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Trạng thái tài khoản
                  </dt>
                  <dd className="mt-1.5 text-sm font-medium">
                    {USER_STATUS_LABEL[registration.manager.status] ?? registration.manager.status}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Không có thông tin Company Manager.</p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {stage === REGISTRATION_STAGE.PENDING ? (
            <DecisionPanel
              onDecided={(companyRegistration) =>
                setView((current) => ({ ...current, registration: companyRegistration }))
              }
              onStateChanged={reload}
              registration={registration}
            />
          ) : (
            <StageOutcome stage={stage} />
          )}

          <dl className="space-y-3 rounded-2xl border bg-card p-5">
            <MetaRow label="Gửi xét duyệt" value={formatDateTime(registration.submittedAt)} />
            <MetaRow label="Xét duyệt lúc" value={formatDateTime(registration.reviewedAt)} />
            <MetaRow label="Kích hoạt lúc" value={formatDateTime(registration.activatedAt)} />
          </dl>

          {accountPanel}
        </aside>
      </div>
    </div>
  )
}

export default CompanyRegistrationReview
