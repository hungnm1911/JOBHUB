import { COMPANY_APPROVAL_STATUS, COMPANY_OPERATIONAL_STATUS } from '@/utils/constant'

const REGISTRATION_STAGE = Object.freeze({
  PENDING: 'pending',
  AWAITING_CONFIRMATION: 'awaitingConfirmation',
  ACTIVE: 'active',
  LOCKED: 'locked',
  REJECTED: 'rejected',
})

const REGISTRATION_STAGE_META = Object.freeze({
  [REGISTRATION_STAGE.PENDING]: {
    label: 'Chờ duyệt',
    className: 'bg-warning/15 text-warning-foreground',
  },
  [REGISTRATION_STAGE.AWAITING_CONFIRMATION]: {
    label: 'Chờ Company Manager kích hoạt',
    className: 'bg-primary/10 text-primary',
  },
  [REGISTRATION_STAGE.ACTIVE]: {
    label: 'Đang hoạt động',
    className: 'bg-primary text-primary-foreground',
  },
  [REGISTRATION_STAGE.LOCKED]: {
    label: 'Đã khóa',
    className: 'bg-destructive/10 text-destructive',
  },
  [REGISTRATION_STAGE.REJECTED]: {
    label: 'Đã từ chối',
    className: 'bg-destructive/10 text-destructive',
  },
})

const REGISTRATION_STAGE_ORDER = Object.freeze([
  REGISTRATION_STAGE.PENDING,
  REGISTRATION_STAGE.AWAITING_CONFIRMATION,
  REGISTRATION_STAGE.ACTIVE,
  REGISTRATION_STAGE.REJECTED,
  REGISTRATION_STAGE.LOCKED,
])

function isRegistrationStage(value) {
  return REGISTRATION_STAGE_ORDER.includes(value)
}

function countRegistrationsByStage(items) {
  return items.reduce(
    (counts, item) => ({ ...counts, [item.stage]: counts[item.stage] + 1 }),
    Object.fromEntries(REGISTRATION_STAGE_ORDER.map((stage) => [stage, 0])),
  )
}

function toRegistrationStage({ approvalStatus, operationalStatus }) {
  if (approvalStatus === COMPANY_APPROVAL_STATUS.PENDING) {
    return REGISTRATION_STAGE.PENDING
  }

  if (approvalStatus === COMPANY_APPROVAL_STATUS.REJECTED) {
    return REGISTRATION_STAGE.REJECTED
  }

  if (operationalStatus === COMPANY_OPERATIONAL_STATUS.ACTIVE) {
    return REGISTRATION_STAGE.ACTIVE
  }

  if (operationalStatus === COMPANY_OPERATIONAL_STATUS.LOCKED) {
    return REGISTRATION_STAGE.LOCKED
  }

  return REGISTRATION_STAGE.AWAITING_CONFIRMATION
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function formatDateTime(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : DATE_TIME_FORMAT.format(date)
}

export {
  REGISTRATION_STAGE,
  REGISTRATION_STAGE_META,
  REGISTRATION_STAGE_ORDER,
  countRegistrationsByStage,
  formatDateTime,
  isRegistrationStage,
  toRegistrationStage,
}
