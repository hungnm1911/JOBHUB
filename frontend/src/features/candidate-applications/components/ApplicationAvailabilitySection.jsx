import { Clock3, LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  editOwnApplicationAvailabilityApi,
  submitOwnApplicationAvailabilityApi,
} from '@/apis/application.api'
import { Button } from '@/components/ui/button'
import { APPLICATION_STATUS, AVAILABILITY_DAY_PART } from '@/utils/constant'
import { APPLICATION_STATUS_LABEL } from '@/features/candidate-dashboard/utils'

import {
  DAY_PART_LABEL,
  canEditAvailability,
  canSubmitAvailabilityFirstTime,
  formatDate,
  isAvailabilitySubmitted,
  resolveDefaultTimezone,
} from '../utils'

function emptySlot() {
  return { date: '', dayPart: AVAILABILITY_DAY_PART.MORNING }
}

function AvailabilitySlotsForm({
  busy,
  timezone,
  slots,
  onTimezoneChange,
  onUpdateSlot,
  onAddSlot,
  onRemoveSlot,
  onCancel,
  onSubmit,
  submitLabel,
  showCancel,
}) {
  return (
    <form className="mt-4 space-y-4" onSubmit={onSubmit}>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Múi giờ (IANA)</span>
        <input
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={busy}
          onChange={(event) => onTimezoneChange(event.target.value)}
          required
          value={timezone}
        />
      </label>

      <div className="space-y-2">
        <p className="text-sm font-medium">Khung thời gian</p>
        {slots.map((slot, index) => (
          <div className="flex flex-wrap items-end gap-2" key={`slot-${index}`}>
            <label className="min-w-[10rem] flex-1 space-y-1">
              <span className="text-xs text-muted-foreground">Ngày</span>
              <input
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={busy}
                onChange={(event) => onUpdateSlot(index, { date: event.target.value })}
                required
                type="date"
                value={slot.date}
              />
            </label>
            <label className="min-w-[8rem] space-y-1">
              <span className="text-xs text-muted-foreground">Buổi</span>
              <select
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={busy}
                onChange={(event) => onUpdateSlot(index, { dayPart: event.target.value })}
                value={slot.dayPart}
              >
                <option value={AVAILABILITY_DAY_PART.MORNING}>
                  {DAY_PART_LABEL[AVAILABILITY_DAY_PART.MORNING]}
                </option>
                <option value={AVAILABILITY_DAY_PART.AFTERNOON}>
                  {DAY_PART_LABEL[AVAILABILITY_DAY_PART.AFTERNOON]}
                </option>
              </select>
            </label>
            <Button
              disabled={busy || slots.length <= 1}
              onClick={() => onRemoveSlot(index)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              <span className="sr-only">Xóa khung</span>
            </Button>
          </div>
        ))}
        <Button
          disabled={busy}
          onClick={onAddSlot}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus aria-hidden="true" className="size-4" />
          Thêm khung
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {showCancel ? (
          <Button disabled={busy} onClick={onCancel} type="button" variant="outline">
            Hủy
          </Button>
        ) : null}
        <Button disabled={busy} type="submit">
          {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

function ApplicationAvailabilitySection({ application, onAvailabilityUpdated }) {
  const availability = application.availability
  const submitted = isAvailabilitySubmitted(availability)
  const canSubmit = canSubmitAvailabilityFirstTime(application)
  const canEdit = canEditAvailability(application)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [timezone, setTimezone] = useState(
    availability?.timezone || resolveDefaultTimezone(),
  )
  const [slots, setSlots] = useState(
    submitted && availability.slots?.length
      ? availability.slots.map((slot) => ({ date: slot.date, dayPart: slot.dayPart }))
      : [emptySlot()],
  )

  const updateSlot = (index, patch) => {
    setSlots((current) =>
      current.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot)),
    )
  }

  const resetFromAvailability = () => {
    setSlots(
      (availability.slots ?? []).map((slot) => ({
        date: slot.date,
        dayPart: slot.dayPart,
      })),
    )
    setTimezone(availability.timezone || resolveDefaultTimezone())
    setEditing(false)
  }

  const handleSave = async (event) => {
    event.preventDefault()
    const cleaned = slots
      .map((slot) => ({ date: slot.date.trim(), dayPart: slot.dayPart }))
      .filter((slot) => slot.date)

    if (cleaned.length === 0) {
      toast.error('Thêm ít nhất một khung thời gian.')
      return
    }

    if (!submitted && !canSubmit) {
      toast.error(
        'Chỉ gửi lịch rảnh khi đơn đang ở trạng thái Đã liên hệ (CONTACTED).',
      )
      return
    }

    if (submitted && !canEdit) {
      toast.error('Hiện không thể chỉnh sửa lịch rảnh.')
      return
    }

    setBusy(true)
    try {
      const response = submitted
        ? await editOwnApplicationAvailabilityApi(application.id, {
            timezone: timezone.trim(),
            slots: cleaned,
            expectedRevision: availability.revision,
          })
        : await submitOwnApplicationAvailabilityApi(application.id, {
            timezone: timezone.trim(),
            slots: cleaned,
          })

      toast.success(submitted ? 'Đã cập nhật lịch rảnh' : 'Đã gửi lịch rảnh')
      onAvailabilityUpdated(response.availability)
      setEditing(false)
    } catch (error) {
      toast.error(error.message || 'Không lưu được lịch rảnh.')
    } finally {
      setBusy(false)
    }
  }

  const statusLabel =
    APPLICATION_STATUS_LABEL[application.status] ?? application.status

  let body = null

  if (submitted && !editing) {
    body = (
      <div className="mt-4 space-y-2">
        <p className="text-xs text-muted-foreground">
          Múi giờ: {availability.timezone}
          {availability.revision != null ? ` · Phiên bản ${availability.revision}` : null}
        </p>
        <ul className="space-y-2">
          {(availability.slots ?? []).map((slot) => (
            <li
              className="rounded-lg bg-secondary/60 px-3 py-2 text-sm"
              key={`${slot.date}-${slot.dayPart}`}
            >
              {formatDate(slot.date) ?? slot.date}
              {DAY_PART_LABEL[slot.dayPart] ? ` · ${DAY_PART_LABEL[slot.dayPart]}` : null}
            </li>
          ))}
        </ul>
        {!canEdit ? (
          <p className="text-xs text-muted-foreground">
            {application.status === APPLICATION_STATUS.HIRED ||
            application.status === APPLICATION_STATUS.REJECTED ||
            application.status === APPLICATION_STATUS.WITHDRAWN
              ? 'Đơn đã kết thúc nên không chỉnh sửa lịch rảnh.'
              : 'Không thể chỉnh sửa khi đang có đề xuất phỏng vấn chờ xác nhận.'}
          </p>
        ) : null}
      </div>
    )
  } else if (canSubmit || (submitted && editing && canEdit)) {
    body = (
      <AvailabilitySlotsForm
        busy={busy}
        onAddSlot={() => setSlots((current) => [...current, emptySlot()])}
        onCancel={resetFromAvailability}
        onRemoveSlot={(index) =>
          setSlots((current) => current.filter((_, slotIndex) => slotIndex !== index))
        }
        onSubmit={handleSave}
        onTimezoneChange={setTimezone}
        onUpdateSlot={updateSlot}
        showCancel={submitted}
        slots={slots}
        submitLabel={submitted ? 'Lưu lịch rảnh' : 'Gửi lịch rảnh'}
        timezone={timezone}
      />
    )
  } else {
    body = (
      <p className="mt-4 rounded-lg bg-secondary/50 px-3 py-3 text-sm text-muted-foreground">
        {application.status === APPLICATION_STATUS.APPLIED ||
        application.status === APPLICATION_STATUS.SCREENING
          ? `Bạn gửi lịch rảnh sau khi nhà tuyển dụng chuyển đơn sang “${APPLICATION_STATUS_LABEL[APPLICATION_STATUS.CONTACTED]}”. Hiện đơn đang “${statusLabel}”.`
          : `Không gửi được lịch rảnh ở trạng thái “${statusLabel}”. Chỉ gửi lần đầu khi đơn ở “${APPLICATION_STATUS_LABEL[APPLICATION_STATUS.CONTACTED]}”.`}
      </p>
    )
  }

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="availability-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
            <Clock3 aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold" id="availability-heading">
              Lịch rảnh của bạn
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {submitted
                ? 'Nhà tuyển dụng dùng các khung này để đề xuất phỏng vấn.'
                : canSubmit
                  ? 'Gửi khung ngày/buổi bạn có thể tham gia phỏng vấn.'
                  : 'Chỉ mở khi đơn ở trạng thái Đã liên hệ.'}
            </p>
          </div>
        </div>
        {submitted && !editing && canEdit ? (
          <Button
            onClick={() => {
              setSlots(
                (availability.slots ?? []).map((slot) => ({
                  date: slot.date,
                  dayPart: slot.dayPart,
                })),
              )
              setTimezone(availability.timezone || resolveDefaultTimezone())
              setEditing(true)
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Chỉnh sửa
          </Button>
        ) : null}
      </div>

      {body}
    </section>
  )
}

export default ApplicationAvailabilitySection
