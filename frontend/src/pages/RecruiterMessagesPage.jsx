import RecruiterPageHeader from '@/features/recruiter-workspace/components/RecruiterPageHeader'
import ConversationInbox from '@/features/recruiter-workspace/components/ConversationInbox'

function RecruiterMessagesPage() {
  return (
    <div className="space-y-5">
      <RecruiterPageHeader
        description="Trò chuyện với ứng viên của các hồ sơ được giao cho bạn."
        title="Tin nhắn"
      />
      <ConversationInbox />
    </div>
  )
}

export default RecruiterMessagesPage
