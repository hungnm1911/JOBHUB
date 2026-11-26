import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import RecruiterPageHeader from '@/features/recruiter-workspace/components/RecruiterPageHeader'
import ManagedJobList from '@/features/recruiter-workspace/components/ManagedJobList'

function RecruiterJobsPage() {
  return (
    <div className="space-y-5">
      <RecruiterPageHeader
        actions={
          <Button asChild>
            <Link to="/recruiter/jobs/new">
              <Plus aria-hidden="true" className="size-4" />
              Tạo job mới
            </Link>
          </Button>
        }
        description="Các Job bạn là người phụ trách chính."
        title="Job tôi phụ trách chính"
      />
      <ManagedJobList />
    </div>
  )
}

export default RecruiterJobsPage
