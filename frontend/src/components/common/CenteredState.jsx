import { cn } from '@/lib/utils'

function CenteredState({ icon: Icon, tone, title, description, action, spinning = false }) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-10 text-center shadow-sm">
      <span className={cn('flex size-16 items-center justify-center rounded-full', tone)}>
        <Icon aria-hidden="true" className={spinning ? 'size-7 animate-spin' : 'size-7'} />
      </span>
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </section>
  )
}

export default CenteredState
