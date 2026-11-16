import { ExternalLink, FolderKanban, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import EmptySectionState from './EmptySectionState'
import ProfileIconButton from './ProfileIconButton'
import ProfileSectionCard from './ProfileSectionCard'

function ProjectsSection({ content, canEdit, onAdd, onEdit, onDelete }) {
  const items = content?.projects ?? []

  return (
    <ProfileSectionCard
      addLabel="Thêm dự án"
      icon={FolderKanban}
      onAdd={canEdit ? onAdd : undefined}
      title="Dự án tiêu biểu"
    >
      {items.length === 0 ? (
        <EmptySectionState
          action={
            canEdit ? (
              <Button onClick={onAdd} size="sm" type="button" variant="outline">
                Thêm dự án
              </Button>
            ) : null
          }
          message="Chưa có dự án. Hãy thêm dự án tiêu biểu của bạn."
        />
      ) : (
        <div
          className={cn(
            'grid gap-3',
            items.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2',
          )}
        >
          {items.map((project, index) => (
            <article className="rounded-lg border p-4" key={`${project.name}-${index}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{project.name || 'Chưa đặt tên'}</h3>
                  {project.role && <p className="mt-0.5 text-xs text-muted-foreground">{project.role}</p>}
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <ProfileIconButton label="Sửa dự án" onClick={() => onEdit(index)}>
                      <Pencil aria-hidden="true" className="size-3.5" />
                    </ProfileIconButton>
                    <ProfileIconButton label="Xóa dự án" onClick={() => onDelete(index)} tone="danger">
                      <Trash2 aria-hidden="true" className="size-3.5" />
                    </ProfileIconButton>
                  </div>
                )}
              </div>
              {project.description && (
                <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">{project.description}</p>
              )}
              {project.technologies?.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {project.technologies.map((tech) => (
                    <li
                      className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                      key={tech}
                    >
                      {tech}
                    </li>
                  ))}
                </ul>
              )}
              {project.projectUrl && (
                <a
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  href={project.projectUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                  Xem dự án
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </ProfileSectionCard>
  )
}

export default ProjectsSection
