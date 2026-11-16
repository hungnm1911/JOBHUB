import { Award, Languages, Pencil, Trash2 } from 'lucide-react'

import { LANGUAGE_PROFICIENCY_LABEL, formatMonthYear } from '../utils'
import EmptySectionState from './EmptySectionState'
import ProfileIconButton from './ProfileIconButton'
import ProfileSectionCard from './ProfileSectionCard'

function CertificationsLanguagesSection({
  content,
  canEdit,
  onAddCertification,
  onEditCertification,
  onDeleteCertification,
  onAddLanguage,
  onEditLanguage,
  onDeleteLanguage,
}) {
  const certifications = content?.certifications ?? []
  const languages = content?.languages ?? []

  return (
    <div className="space-y-5">
      <ProfileSectionCard
        addLabel="Thêm chứng chỉ"
        icon={Award}
        onAdd={canEdit ? onAddCertification : undefined}
        title="Chứng chỉ"
      >
        {certifications.length === 0 ? (
          <EmptySectionState message="Chưa có chứng chỉ." />
        ) : (
          <ul className="space-y-3">
            {certifications.map((item, index) => (
              <li className="rounded-lg border p-3" key={`${item.name}-${index}`}>
                <div className="flex items-start gap-3">
                  <Award aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-pretty">{item.name || 'Chứng chỉ'}</p>
                    <p className="text-xs text-muted-foreground">
                      {[item.issuer, formatMonthYear(item.issueDate)].filter(Boolean).join(' · ')}
                    </p>
                    {item.credentialUrl && (
                      <a
                        className="mt-1 inline-flex text-xs font-medium text-primary hover:underline"
                        href={item.credentialUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Xem chứng chỉ
                      </a>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <ProfileIconButton
                        label="Sửa chứng chỉ"
                        onClick={() => onEditCertification(index)}
                      >
                        <Pencil aria-hidden="true" className="size-3.5" />
                      </ProfileIconButton>
                      <ProfileIconButton
                        label="Xóa chứng chỉ"
                        onClick={() => onDeleteCertification(index)}
                        tone="danger"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                      </ProfileIconButton>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ProfileSectionCard>

      <ProfileSectionCard
        addLabel="Thêm ngoại ngữ"
        icon={Languages}
        onAdd={canEdit ? onAddLanguage : undefined}
        title="Ngoại ngữ"
      >
        {languages.length === 0 ? (
          <EmptySectionState message="Chưa có ngoại ngữ." />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {languages.map((item, index) => {
              const proficiency =
                LANGUAGE_PROFICIENCY_LABEL[item.proficiency] ?? item.proficiency ?? '—'
              return (
                <li
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-card py-1.5 pl-3 pr-1"
                  key={`${item.name}-${index}`}
                >
                  <Languages aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                  <span className="flex min-w-0 items-baseline gap-1.5 pr-1">
                    <span className="text-sm font-semibold whitespace-nowrap">
                      {item.name || 'Ngôn ngữ'}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {proficiency}
                    </span>
                  </span>
                  {canEdit && (
                    <span className="flex shrink-0 items-center border-l pl-0.5">
                      <ProfileIconButton
                        label="Sửa ngoại ngữ"
                        onClick={() => onEditLanguage(index)}
                      >
                        <Pencil aria-hidden="true" className="size-3.5" />
                      </ProfileIconButton>
                      <ProfileIconButton
                        label="Xóa ngoại ngữ"
                        onClick={() => onDeleteLanguage(index)}
                        tone="danger"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                      </ProfileIconButton>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </ProfileSectionCard>
    </div>
  )
}

export default CertificationsLanguagesSection
