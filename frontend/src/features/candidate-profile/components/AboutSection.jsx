import { UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import RichTextViewer from '@/components/common/RichTextViewer'

import EmptySectionState from './EmptySectionState'
import ProfileSectionCard from './ProfileSectionCard'

function AboutSection({ content, canEdit, onEdit }) {
  const html = content?.professionalSummaryHtml
  const text = content?.professionalSummary

  return (
    <ProfileSectionCard
      icon={UserRound}
      onEdit={canEdit ? onEdit : undefined}
      title="Giới thiệu bản thân"
    >
      {!text && !html ? (
        <EmptySectionState
          action={
            canEdit ? (
              <Button onClick={onEdit} size="sm" type="button" variant="outline">
                Thêm giới thiệu
              </Button>
            ) : null
          }
          message="Chưa có nội dung giới thiệu. Nội dung này lấy từ Professional Summary của CV Generated."
        />
      ) : html ? (
        <RichTextViewer format="html" value={html} />
      ) : (
        <RichTextViewer format="plain" value={text} />
      )}
    </ProfileSectionCard>
  )
}

export default AboutSection
