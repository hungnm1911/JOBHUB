import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

function SkillChips({ skills }) {
  if (!skills.length) return null
  return (
    <ul aria-label="Kỹ năng" className="flex flex-wrap gap-2">
      {skills.map((skill) => (
        <li className="rounded-md bg-secondary px-2 py-0.5 text-xs" key={skill}>
          {skill}
        </li>
      ))}
    </ul>
  )
}

// `from` is the search query string, so the preview can return to the same results.
function CandidateCvCard({ cv, from, onInvite }) {
  return (
    <li className="flex flex-col gap-4 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 md:flex-row md:items-start">
      <div className="flex min-w-0 flex-1 gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
          <FileText aria-hidden="true" className="size-6" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h2 className="text-base leading-6 font-semibold break-words">{cv.cvName}</h2>
            <p className="text-sm break-words text-muted-foreground">{cv.candidateName ?? 'Ứng viên'}</p>
          </div>
          {cv.facts.length > 0 && (
            <dl className="flex flex-wrap gap-x-6 gap-y-2">
              {cv.facts.map((fact) => (
                <div className="min-w-0" key={fact.label}>
                  <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                  <dd className="text-sm break-words">{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <SkillChips skills={cv.skills} />
        </div>
      </div>
      <div className="flex shrink-0 gap-2 md:w-36 md:flex-col">
        <Button className="flex-1 md:flex-none" onClick={() => onInvite(cv)} size="sm" type="button">
          Mời ứng tuyển
        </Button>
        <Button asChild className="flex-1 md:flex-none" size="sm" variant="outline">
          <Link state={{ cv, from }} to={`/recruiter/candidates/${cv.cvId}`}>
            Xem CV
          </Link>
        </Button>
      </div>
    </li>
  )
}

export { SkillChips }
export default CandidateCvCard
