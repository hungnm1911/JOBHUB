import { MessageSquare } from 'lucide-react'
import { Link } from 'react-router-dom'

import CenteredState from '@/components/common/CenteredState'
import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'

function CandidateMessagesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="Hội thoại gắn với từng đơn ứng tuyển."
        eyebrow="Ứng viên"
        title="Tin nhắn"
      />
      <CenteredState
        action={
          <Button asChild variant="outline">
            <Link to="/candidate/applications">Xem đơn ứng tuyển</Link>
          </Button>
        }
        description="Backend hỗ trợ hội thoại theo từng Application. Giao diện hộp thư tổng hợp chưa được triển khai; bạn có thể theo dõi đơn để tiếp tục trao đổi khi có."
        icon={MessageSquare}
        title="Chưa có hộp thư tổng hợp"
        tone="bg-secondary text-muted-foreground"
      />
    </div>
  )
}

export default CandidateMessagesPage
