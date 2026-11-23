import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe,
  LoaderCircle,
  Pencil,
  Sun,
  Sunset,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  editOwnApplicationAvailabilityApi,
  submitOwnApplicationAvailabilityApi,
} from '@/apis/application.api'
import { Button } from '@/components/ui/button'
import useUnsavedChangesPrompt from '@/components/common/useUnsavedChangesPrompt'
import { SelectDropdown } from '@/components/ui/select-dropdown'
import { APPLICATION_STATUS_LABEL } from '@/features/candidate-dashboard/utils'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS, AVAILABILITY_DAY_PART } from '@/utils/constant'

import {
  DAY_PART_LABEL,
  canEditAvailability,
  canSubmitAvailabilityFirstTime,
  formatDate,
  isAvailabilitySubmitted,
  resolveDefaultTimezone,
} from '../utils'

const WEEKDAY_LABELS = Object.freeze(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'])

const COMMON_TIMEZONES = Object.freeze([
  { value: 'Asia/Ho_Chi_Minh', label: 'Việt Nam (GMT+7 · Asia/Ho_Chi_Minh)' },
  { value: 'Asia/Bangkok', label: 'Thái Lan (GMT+7 · Asia/Bangkok)' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8 · Asia/Singapore)' },
  { value: 'Asia/Tokyo', label: 'Nhật Bản (GMT+9 · Asia/Tokyo)' },
  { value: 'Asia/Seoul', label: 'Hàn Quốc (GMT+9 · Asia/Seoul)' },
  { value: 'Europe/London', label: 'London (UTC/BST · Europe/London)' },
  { value: 'America/New_York', label: 'New York (EST/EDT · America/New_York)' },
])

const monthYearFormatter = new Intl.DateTimeFormat('vi-VN', {
  month: 'long',
  year: 'numeric',
})

function toIsoDateString(year, monthIndex, day) {
  const mm = String(monthIndex + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

function getTodayInTimezone(timezone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const formatted = formatter.format(new Date())
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return formatted
    }
  } catch {
    // Fallback to local calendar date
  }
  const now = new Date()
  return toIsoDateString(now.getFullYear(), now.getMonth(), now.getDate())
}

function buildCalendarMonthCells(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  // Monday = 0 ... Sunday = 6
  const leadingEmptyCount = (firstDay.getDay() + 6) % 7

  const cells = []
  for (let i = 0; i < leadingEmptyCount; i += 1) {
    cells.push(null)
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      date: toIsoDateString(year, monthIndex, day),
    })
  }
  return cells
}

function sortSlots(slots) {
  const order = {
    [AVAILABILITY_DAY_PART.MORNING]: 0,
    [AVAILABILITY_DAY_PART.AFTERNOON]: 1,
  }
  return [...slots].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date)
    }
    return (order[left.dayPart] ?? 0) - (order[right.dayPart] ?? 0)
  })
}

function AvailabilityDatePickerForm({
  busy,
  timezone,
  slots,
  onTimezoneChange,
  onChangeSlots,
  onCancel,
  onSubmit,
  submitLabel,
  showCancel,
}) {
  const todayIso = useMemo(() => getTodayInTimezone(timezone), [timezone])

  const initialDateStr = slots[0]?.date >= todayIso ? slots[0].date : todayIso
  const [activeDate, setActiveDate] = useState(initialDateStr)
  const [viewMonth, setViewMonth] = useState(() => {
    const [y, m] = initialDateStr.split('-').map(Number)
    return {
      year: y || new Date().getFullYear(),
      monthIndex: (m ? m - 1 : new Date().getMonth()),
    }
  })

  const cells = useMemo(
    () => buildCalendarMonthCells(viewMonth.year, viewMonth.monthIndex),
    [viewMonth.year, viewMonth.monthIndex],
  )

  const monthTitle = useMemo(() => {
    const d = new Date(viewMonth.year, viewMonth.monthIndex, 1)
    return monthYearFormatter.format(d)
  }, [viewMonth.year, viewMonth.monthIndex])

  const dayPartsByDate = useMemo(() => {
    const map = new Map()
    for (const slot of slots) {
      if (!slot.date) {
        continue
      }
      const existing = map.get(slot.date) ?? new Set()
      existing.add(slot.dayPart)
      map.set(slot.date, existing)
    }
    return map
  }, [slots])

  const activeDayParts = dayPartsByDate.get(activeDate) ?? new Set()
  const sortedSlots = useMemo(() => sortSlots(slots.filter((s) => s.date)), [slots])

  const timezoneOptions = useMemo(() => {
    if (!timezone || COMMON_TIMEZONES.some((item) => item.value === timezone)) {
      return COMMON_TIMEZONES
    }
    return [{ value: timezone, label: timezone }, ...COMMON_TIMEZONES]
  }, [timezone])

  const goPrevMonth = () => {
    setViewMonth((current) =>
      current.monthIndex === 0
        ? { year: current.year - 1, monthIndex: 11 }
        : { year: current.year, monthIndex: current.monthIndex - 1 },
    )
  }

  const goNextMonth = () => {
    setViewMonth((current) =>
      current.monthIndex === 11
        ? { year: current.year + 1, monthIndex: 0 }
        : { year: current.year, monthIndex: current.monthIndex + 1 },
    )
  }

  const toggleSlot = (date, dayPart) => {
    if (!date || date < todayIso) {
      return
    }
    const exists = slots.some((slot) => slot.date === date && slot.dayPart === dayPart)
    const next = exists
      ? slots.filter((slot) => !(slot.date === date && slot.dayPart === dayPart))
      : [...slots.filter((slot) => slot.date), { date, dayPart }]
    onChangeSlots(sortSlots(next))
  }

  const selectFullDay = (date) => {
    if (!date || date < todayIso) {
      return
    }
    const hasMorning = slots.some(
      (s) => s.date === date && s.dayPart === AVAILABILITY_DAY_PART.MORNING,
    )
    const hasAfternoon = slots.some(
      (s) => s.date === date && s.dayPart === AVAILABILITY_DAY_PART.AFTERNOON,
    )
    if (hasMorning && hasAfternoon) {
      onChangeSlots(sortSlots(slots.filter((s) => s.date !== date)))
      return
    }
    const withoutDate = slots.filter((s) => s.date && s.date !== date)
    onChangeSlots(
      sortSlots([
        ...withoutDate,
        { date, dayPart: AVAILABILITY_DAY_PART.MORNING },
        { date, dayPart: AVAILABILITY_DAY_PART.AFTERNOON },
      ]),
    )
  }

  const handlePickDate = (date) => {
    setActiveDate(date)
    const existing = dayPartsByDate.get(date)
    if (!existing || existing.size === 0) {
      // Automatically select Morning on first date tap so 1 click on the calendar adds a slot immediately
      const next = [...slots.filter((s) => s.date), { date, dayPart: AVAILABILITY_DAY_PART.MORNING }]
      onChangeSlots(sortSlots(next))
    }
  }

  return (
    <form className="mt-4 space-y-4" onSubmit={onSubmit}>
      <div className="rounded-xl border bg-background/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <button
            aria-label="Tháng trước"
            className="inline-flex size-8 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            disabled={busy}
            onClick={goPrevMonth}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <p className="text-sm font-semibold capitalize">{monthTitle}</p>
          <button
            aria-label="Tháng sau"
            className="inline-flex size-8 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            disabled={busy}
            onClick={goNextMonth}
            type="button"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
          {WEEKDAY_LABELS.map((label) => (
            <span className="py-1" key={label}>
              {label}
            </span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((cell, index) => {
            if (!cell) {
              return <span className="h-9" key={`empty-${index}`} />
            }
            const isPast = cell.date < todayIso
            const isToday = cell.date === todayIso
            const isActive = cell.date === activeDate
            const parts = dayPartsByDate.get(cell.date)
            const hasMorning = parts?.has(AVAILABILITY_DAY_PART.MORNING) ?? false
            const hasAfternoon = parts?.has(AVAILABILITY_DAY_PART.AFTERNOON) ?? false
            const hasAny = hasMorning || hasAfternoon

            return (
              <button
                aria-label={`Ngày ${cell.date}`}
                aria-pressed={isActive}
                className={cn(
                  'relative flex h-9 flex-col items-center justify-center rounded-lg text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isPast && 'pointer-events-none text-muted-foreground/35',
                  !isPast && !hasAny && !isActive && 'hover:bg-secondary text-foreground',
                  hasAny &&
                    !isActive &&
                    'border border-primary/40 bg-primary/10 font-semibold text-primary',
                  isActive && 'bg-primary font-semibold text-primary-foreground shadow-2xs',
                  isToday && !isActive && !hasAny && 'border border-dashed border-primary/50',
                )}
                disabled={busy || isPast}
                key={cell.date}
                onClick={() => handlePickDate(cell.date)}
                type="button"
              >
                <span>{cell.day}</span>
                {hasAny && (
                  <span className="mt-0.5 flex items-center gap-0.5">
                    {hasMorning && (
                      <span
                        className={cn(
                          'size-1 rounded-full',
                          isActive ? 'bg-primary-foreground' : 'bg-amber-500',
                        )}
                      />
                    )}
                    {hasAfternoon && (
                      <span
                        className={cn(
                          'size-1 rounded-full',
                          isActive ? 'bg-primary-foreground' : 'bg-primary',
                        )}
                      />
                    )}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {activeDate && activeDate >= todayIso && (
          <div className="mt-3 rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">
                Chọn buổi cho ngày{' '}
                <span className="text-primary">{formatDate(activeDate) ?? activeDate}</span>
              </p>
              <button
                className="text-[11px] font-semibold text-primary hover:underline"
                disabled={busy}
                onClick={() => selectFullDay(activeDate)}
                type="button"
              >
                {activeDayParts.size === 2 ? 'Bỏ chọn ngày này' : 'Chọn cả ngày'}
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                aria-pressed={activeDayParts.has(AVAILABILITY_DAY_PART.MORNING)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors',
                  activeDayParts.has(AVAILABILITY_DAY_PART.MORNING)
                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-800'
                    : 'bg-background text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
                disabled={busy}
                onClick={() => toggleSlot(activeDate, AVAILABILITY_DAY_PART.MORNING)}
                type="button"
              >
                <Sun aria-hidden="true" className="size-3.5" />
                {DAY_PART_LABEL[AVAILABILITY_DAY_PART.MORNING]}
              </button>

              <button
                aria-pressed={activeDayParts.has(AVAILABILITY_DAY_PART.AFTERNOON)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors',
                  activeDayParts.has(AVAILABILITY_DAY_PART.AFTERNOON)
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'bg-background text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
                disabled={busy}
                onClick={() => toggleSlot(activeDate, AVAILABILITY_DAY_PART.AFTERNOON)}
                type="button"
              >
                <Sunset aria-hidden="true" className="size-3.5" />
                {DAY_PART_LABEL[AVAILABILITY_DAY_PART.AFTERNOON]}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            Khung đã chọn ({sortedSlots.length})
          </p>
          {sortedSlots.length > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-destructive"
              disabled={busy}
              onClick={() => onChangeSlots([])}
              type="button"
            >
              Xóa tất cả
            </button>
          )}
        </div>

        {sortedSlots.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
            Chạm vào một ngày trên lịch để chọn buổi sáng hoặc buổi chiều bạn rảnh.
          </p>
        ) : (
          <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {sortedSlots.map((slot) => {
              const isMorning = slot.dayPart === AVAILABILITY_DAY_PART.MORNING
              return (
                <li
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border py-1 pr-1.5 pl-2.5 text-xs font-medium',
                    isMorning
                      ? 'border-amber-500/35 bg-amber-500/10 text-amber-800'
                      : 'border-primary/30 bg-primary/10 text-primary',
                  )}
                  key={`${slot.date}-${slot.dayPart}`}
                >
                  <button
                    className="inline-flex items-center gap-1 text-left hover:underline"
                    disabled={busy}
                    onClick={() => setActiveDate(slot.date)}
                    type="button"
                  >
                    {isMorning ? (
                      <Sun aria-hidden="true" className="size-3" />
                    ) : (
                      <Sunset aria-hidden="true" className="size-3" />
                    )}
                    <span>
                      {formatDate(slot.date) ?? slot.date} · {DAY_PART_LABEL[slot.dayPart]}
                    </span>
                  </button>
                  <button
                    aria-label={`Xóa ${slot.date} ${DAY_PART_LABEL[slot.dayPart]}`}
                    className=" inline-flex size-4 items-center justify-center rounded-full hover:bg-foreground/10"
                    disabled={busy}
                    onClick={() => toggleSlot(slot.date, slot.dayPart)}
                    type="button"
                  >
                    <X aria-hidden="true" className="size-3" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="space-y-1">
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Globe aria-hidden="true" className="size-3.5" />
          Múi giờ
        </span>
        <SelectDropdown
          ariaLabel="Múi giờ"
          disabled={busy}
          onChange={onTimezoneChange}
          options={timezoneOptions}
          size="sm"
          value={timezone}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {showCancel ? (
          <Button disabled={busy} onClick={onCancel} size="sm" type="button" variant="outline">
            Hủy
          </Button>
        ) : null}
        <Button
          className="flex-1"
          disabled={busy || sortedSlots.length === 0}
          size="sm"
          type="submit"
        >
          {busy ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <CalendarDays aria-hidden="true" className="size-4" />
          )}
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
      : [],
  )
  const savedSlots = (availability?.slots ?? []).map((slot) => ({
    date: slot.date,
    dayPart: slot.dayPart,
  }))
  const isDirty = (canSubmit || editing) && (
    timezone !== (availability?.timezone || resolveDefaultTimezone()) ||
    JSON.stringify(sortSlots(slots)) !== JSON.stringify(sortSlots(savedSlots))
  )
  const { confirmDiscard, markSaved } = useUnsavedChangesPrompt(isDirty)

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
    const cleaned = sortSlots(
      slots
        .map((slot) => ({ date: slot.date.trim(), dayPart: slot.dayPart }))
        .filter((slot) => slot.date),
    )

    if (cleaned.length === 0) {
      toast.error('Hãy chọn ít nhất một ngày và buổi rảnh trên lịch.')
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

      toast.success(submitted ? 'Đã cập nhật lịch rảnh phỏng vấn' : 'Đã gửi lịch rảnh phỏng vấn')
      markSaved()
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

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="availability-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold" id="availability-heading">
              Lịch rảnh phỏng vấn
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {submitted
                ? 'Nhà tuyển dụng dùng các khung này để đặt lịch phỏng vấn.'
                : canSubmit
                  ? 'Chọn ngày và buổi (Sáng/Chiều) bạn có thể tham gia phỏng vấn.'
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
            <Pencil aria-hidden="true" className="size-3.5" />
            Sửa lịch
          </Button>
        ) : null}
      </div>

      {submitted && !editing ? (
        <div className="mt-4 space-y-3">
          <ul className="flex flex-wrap gap-1.5">
            {sortSlots(availability.slots ?? []).map((slot) => {
              const isMorning = slot.dayPart === AVAILABILITY_DAY_PART.MORNING
              return (
                <li
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                    isMorning
                      ? 'border-amber-500/35 bg-amber-500/10 text-amber-800'
                      : 'border-primary/30 bg-primary/10 text-primary',
                  )}
                  key={`${slot.date}-${slot.dayPart}`}
                >
                  {isMorning ? (
                    <Sun aria-hidden="true" className="size-3.5" />
                  ) : (
                    <Sunset aria-hidden="true" className="size-3.5" />
                  )}
                  <span>
                    {formatDate(slot.date) ?? slot.date}
                    {DAY_PART_LABEL[slot.dayPart] ? ` · ${DAY_PART_LABEL[slot.dayPart]}` : null}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 aria-hidden="true" className="size-3.5" />
            Múi giờ: {availability.timezone}
            {availability.revision != null ? ` · Lần cập nhật #${availability.revision + 1}` : null}
          </p>
          {!canEdit ? (
            <p className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              {application.status === APPLICATION_STATUS.HIRED ||
              application.status === APPLICATION_STATUS.REJECTED ||
              application.status === APPLICATION_STATUS.WITHDRAWN
                ? 'Đơn đã kết thúc nên không chỉnh sửa lịch rảnh.'
                : 'Không thể chỉnh sửa khi đang có đề xuất phỏng vấn chờ xác nhận.'}
            </p>
          ) : null}
        </div>
      ) : canSubmit || (submitted && editing && canEdit) ? (
        <AvailabilityDatePickerForm
          busy={busy}
          onCancel={() => confirmDiscard(resetFromAvailability)}
          onChangeSlots={setSlots}
          onSubmit={handleSave}
          onTimezoneChange={setTimezone}
          showCancel={submitted}
          slots={slots}
          submitLabel={submitted ? 'Lưu lịch rảnh' : 'Gửi lịch rảnh'}
          timezone={timezone}
        />
      ) : (
        <p className="mt-4 rounded-lg bg-secondary/50 px-3 py-3 text-sm text-muted-foreground">
          {application.status === APPLICATION_STATUS.APPLIED ||
          application.status === APPLICATION_STATUS.SCREENING
            ? `Bạn gửi lịch rảnh sau khi nhà tuyển dụng chuyển đơn sang “${APPLICATION_STATUS_LABEL[APPLICATION_STATUS.CONTACTED]}”. Hiện đơn đang “${statusLabel}”.`
            : `Không gửi được lịch rảnh ở trạng thái “${statusLabel}”. Chỉ gửi lần đầu khi đơn ở “${APPLICATION_STATUS_LABEL[APPLICATION_STATUS.CONTACTED]}”.`}
        </p>
      )}
    </section>
  )
}

export default ApplicationAvailabilitySection
