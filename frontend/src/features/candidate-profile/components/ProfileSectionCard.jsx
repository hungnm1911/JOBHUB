import { Pencil, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

function ProfileSectionCard({
  title,
  icon: Icon,
  onAdd,
  onEdit,
  addLabel = 'Thêm',
  editLabel = 'Chỉnh sửa',
  children,
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon ? (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon aria-hidden="true" className="size-4" />
            </span>
          ) : null}
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {onEdit && (
            <Button onClick={onEdit} size="sm" type="button" variant="outline">
              <Pencil aria-hidden="true" className="size-3.5" />
              {editLabel}
            </Button>
          )}
          {onAdd && (
            <Button onClick={onAdd} size="sm" type="button" variant="outline">
              <Plus aria-hidden="true" className="size-3.5" />
              {addLabel}
            </Button>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

export default ProfileSectionCard
