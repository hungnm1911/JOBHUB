import { Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import RecommendedJobsSection from '@/features/candidate-dashboard/components/RecommendedJobsSection'
import useCandidateRecommendations from '@/features/candidate-dashboard/hooks/useCandidateRecommendations'

function CandidateAiJobsPage() {
  const recommendations = useCandidateRecommendations()

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button
            disabled={recommendations.status === 'loading'}
            onClick={recommendations.load}
            type="button"
          >
            <Sparkles aria-hidden="true" className="size-4" />
            {recommendations.status === 'loading' ? 'Đang phân tích…' : 'Lấy gợi ý AI'}
          </Button>
        }
        description="Gợi ý dựa trên CV mặc định của bạn thông qua API recommendation hiện có."
        eyebrow="Ứng viên"
        title="Việc làm phù hợp với AI"
      />

      {recommendations.status === 'idle' && (
        <section className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          <p>
            Nhấn &quot;Lấy gợi ý AI&quot; để gọi API recommendation. Kết quả chỉ hiển thị khi bạn đã
            có CV mặc định và hệ thống AI trả về việc làm phù hợp.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/candidate/cvs">Kiểm tra CV mặc định</Link>
          </Button>
        </section>
      )}

      {recommendations.status !== 'idle' && (
        <RecommendedJobsSection
          error={recommendations.error}
          jobs={[]}
          loading={recommendations.status === 'loading'}
          recommendations={recommendations.recommendations}
          source="ai"
        />
      )}
    </div>
  )
}

export default CandidateAiJobsPage
