import { Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'

import EmptySectionState from './EmptySectionState'
import ProfileSectionCard from './ProfileSectionCard'

function normalizeSkill(value) {
  return value.trim().replace(/\s+/g, ' ')
}

function dedupeSkills(...lists) {
  const seen = new Set()
  const result = []

  for (const list of lists) {
    for (const raw of list ?? []) {
      const skill = normalizeSkill(String(raw ?? ''))
      if (!skill) {
        continue
      }
      const key = skill.toLocaleLowerCase('vi')
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      result.push(skill)
    }
  }

  return result
}

function SkillsSection({ content, skillTags = [], canEdit, onEdit }) {
  const skills = dedupeSkills(content?.skills, skillTags)

  return (
    <ProfileSectionCard
      icon={Sparkles}
      onEdit={canEdit ? onEdit : undefined}
      title="Kỹ năng"
    >
      {skills.length === 0 ? (
        <EmptySectionState
          action={
            canEdit ? (
              <Button onClick={onEdit} size="sm" type="button" variant="outline">
                Thêm kỹ năng
              </Button>
            ) : null
          }
          message="Chưa có kỹ năng. Hãy bổ sung các kỹ năng nghề nghiệp của bạn."
        />
      ) : (
        <ul className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li
              className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
              key={skill.toLocaleLowerCase('vi')}
            >
              {skill}
            </li>
          ))}
        </ul>
      )}
    </ProfileSectionCard>
  )
}

export default SkillsSection
