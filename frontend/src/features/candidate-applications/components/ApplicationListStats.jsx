import { BriefcaseBusiness, CheckCircle2, ClipboardList, MessagesSquare } from 'lucide-react'

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      </div>
    </article>
  )
}

function ApplicationListStats({ stats }) {
  if (!stats) {
    return null
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        hint="Tất cả đơn bạn đã nộp"
        icon={BriefcaseBusiness}
        label="Tổng đơn đã gửi"
        value={stats.total}
      />
      <StatCard
        hint="Đang sàng lọc hoặc đã liên hệ"
        icon={ClipboardList}
        label="Đang xét duyệt"
        value={stats.reviewing}
      />
      <StatCard
        hint="Đã lên lịch hoặc đã phỏng vấn"
        icon={MessagesSquare}
        label="Phỏng vấn"
        value={stats.interviewing}
      />
      <StatCard
        hint="Đơn ở trạng thái Được nhận"
        icon={CheckCircle2}
        label="Được nhận"
        value={stats.hired}
      />
    </section>
  )
}

export default ApplicationListStats
