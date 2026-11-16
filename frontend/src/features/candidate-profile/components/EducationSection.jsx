import { GraduationCap, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { formatDateRange, sortByStartDateDesc } from '../utils'
import EmptySectionState from './EmptySectionState'
import ProfileIconButton from './ProfileIconButton'
import ProfileSectionCard from './ProfileSectionCard'

function EducationSection({ content, canEdit, onAdd, onEdit, onDelete }) {
  const source = content?.educations ?? []
  const items = sortByStartDateDesc(source)

  return (
    <ProfileSectionCard
      addLabel="Thêm học vấn"
      icon={GraduationCap}
      onAdd={canEdit ? onAdd : undefined}
      title="Học vấn"
    >
      {items.length === 0 ? (
        <EmptySectionState
          action={
            canEdit ? (
              <Button onClick={onAdd} size="sm" type="button" variant="outline">
                Thêm học vấn
              </Button>
            ) : null
          }
          message="Chưa có thông tin học vấn."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const originalIndex = source.indexOf(item)
            const title =
              [item.degree, item.fieldOfStudy].filter(Boolean).join(' · ') || 'Chưa có bằng cấp'
            return (
              <li className="rounded-lg border p-3.5" key={`${item.institutionName}-${originalIndex}`}>
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <GraduationCap aria-hidden="true" className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold leading-snug text-pretty" title={title}>
                      {title}
                    </h3>
                    <p
                      className="mt-0.5 text-sm leading-snug text-muted-foreground text-pretty"
                      title={item.institutionName || undefined}
                    >
                      {item.institutionName || 'Chưa có trường'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateRange(item.startDate, item.endDate)}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <ProfileIconButton
                        label="Sửa học vấn"
                        onClick={() => onEdit(originalIndex)}
                      >
                        <Pencil aria-hidden="true" className="size-3.5" />
                      </ProfileIconButton>
                      <ProfileIconButton
                        label="Xóa học vấn"
                        onClick={() => onDelete(originalIndex)}
                        tone="danger"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                      </ProfileIconButton>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </ProfileSectionCard>
  )
}

export default EducationSection
