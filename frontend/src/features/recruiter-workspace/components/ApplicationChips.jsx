import { APPLICATION_SOURCE_LABEL } from '@/features/candidate-applications/utils'
import { cn } from '@/lib/utils'

import { Avatar } from './Panel'

function SourceChip({ source }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md border bg-secondary px-2 py-0.5 text-xs font-medium">
      {APPLICATION_SOURCE_LABEL[source] ?? source}
    </span>
  )
}

function AssigneeChip({ recruiter, className }) {
  if (!recruiter) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center rounded-md bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning-foreground',
          className,
        )}
      >
        Chưa phân công
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 text-xs',
        className,
      )}
    >
      <Avatar className="size-5 text-[0.5625rem]" person={recruiter} />
      <span className="min-w-0 break-words">
        <span className="font-medium">{recruiter.fullName ?? 'Nhà tuyển dụng'}</span>
        {recruiter.jobTitle ? ` · ${recruiter.jobTitle}` : ''}
      </span>
    </span>
  )
}

export { AssigneeChip, SourceChip }
