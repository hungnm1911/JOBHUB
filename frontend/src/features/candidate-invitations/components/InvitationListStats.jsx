import { CheckCircle2, ClipboardList, MailOpen, XCircle } from 'lucide-react'

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

function InvitationListStats({ stats }) {
  if (!stats) {
    return null
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        hint="Tất cả lời mời bạn đã nhận"
        icon={MailOpen}
        label="Tổng lời mời nhận được"
        value={stats.total}
      />
      <StatCard
        hint="Cần phản hồi trước khi hết hạn"
        icon={ClipboardList}
        label="Đang chờ phản hồi"
        value={stats.pending}
      />
      <StatCard
        hint="Đã tạo đơn ứng tuyển từ lời mời"
        icon={CheckCircle2}
        label="Đã chấp nhận"
        value={stats.accepted}
      />
      <StatCard
        hint="Bạn đã từ chối lời mời"
        icon={XCircle}
        label="Đã từ chối"
        value={stats.rejected}
      />
    </section>
  )
}

export default InvitationListStats
