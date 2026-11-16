import { BriefcaseBusiness, Building2, CheckCircle2, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  formatDateRange,
  formatDuration,
  sortByStartDateDesc,
} from '../utils'
import EmptySectionState from './EmptySectionState'
import ProfileIconButton from './ProfileIconButton'
import ProfileSectionCard from './ProfileSectionCard'

function ExperienceSection({ content, canEdit, onAdd, onEdit, onDelete }) {
  const source = content?.workExperiences ?? []
  const items = sortByStartDateDesc(source)

  return (
    <ProfileSectionCard
      addLabel="Thêm kinh nghiệm"
      icon={BriefcaseBusiness}
      onAdd={canEdit ? onAdd : undefined}
      title="Kinh nghiệm làm việc"
    >
      {items.length === 0 ? (
        <EmptySectionState
          action={
            canEdit ? (
              <Button onClick={onAdd} size="sm" type="button" variant="outline">
                Thêm kinh nghiệm
              </Button>
            ) : null
          }
          message="Chưa có kinh nghiệm làm việc trên CV Generated hiện tại."
        />
      ) : (
        <ol className="relative space-y-4 before:absolute before:top-4 before:bottom-4 before:left-4 before:w-px before:bg-border">
          {items.map((item, itemOrder) => {
            const originalIndex = source.indexOf(item)
            const range = formatDateRange(item.startDate, item.endDate)
            const duration = formatDuration(item.startDate, item.endDate)
            const isCurrent = !item.endDate
            const meta = [range, duration, isCurrent ? 'Đang làm việc' : null]
              .filter(Boolean)
              .join(' · ')

            return (
              <li
                className="relative flex gap-3 sm:gap-4"
                key={`${item.companyName}-${item.position}-${originalIndex}`}
              >
                <span
                  className={cn(
                    'relative z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card',
                    itemOrder === 0
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-primary/20 bg-primary/10 text-primary',
                  )}
                >
                  <Building2 aria-hidden="true" className="size-3.5" />
                </span>

                <article className="min-w-0 flex-1 rounded-lg border bg-background/60 p-3.5 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold leading-snug">
                        {item.position || 'Chưa có vị trí'}
                      </h3>
                      <p className="mt-0.5 text-sm font-medium text-primary">
                        {item.companyName || 'Chưa có công ty'}
                      </p>
                      {meta && (
                        <p className="mt-2 inline-flex max-w-full rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                          <span className="truncate">{meta}</span>
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <ProfileIconButton
                          label="Sửa kinh nghiệm"
                          onClick={() => onEdit(originalIndex)}
                        >
                          <Pencil aria-hidden="true" className="size-3.5" />
                        </ProfileIconButton>
                        <ProfileIconButton
                          label="Xóa kinh nghiệm"
                          onClick={() => onDelete(originalIndex)}
                          tone="danger"
                        >
                          <Trash2 aria-hidden="true" className="size-3.5" />
                        </ProfileIconButton>
                      </div>
                    )}
                  </div>

                  {item.description && (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </p>
                  )}

                  {item.achievements?.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {item.achievements.map((achievement) => (
                        <li
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                          key={achievement}
                        >
                          <CheckCircle2
                            aria-hidden="true"
                            className="mt-0.5 size-3.5 shrink-0 text-primary"
                          />
                          <span>{achievement}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {item.technologies?.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {item.technologies.map((tech) => (
                        <li
                          className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                          key={tech}
                        >
                          {tech}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </li>
            )
          })}
        </ol>
      )}
    </ProfileSectionCard>
  )
}

export default ExperienceSection
