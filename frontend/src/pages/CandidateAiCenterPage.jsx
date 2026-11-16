import { Bot, FileSearch, Sparkles, WandSparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'

const AI_CAPABILITIES = [
  {
    icon: Sparkles,
    title: 'Gợi ý việc làm',
    description: 'Đề xuất việc làm dựa trên CV mặc định qua API recommendation.',
    to: '/candidate/ai-jobs',
    action: 'Mở gợi ý AI',
  },
  {
    icon: FileSearch,
    title: 'Đánh giá CV theo việc làm',
    description:
      'Backend đã có API đánh giá CV cho từng Job. Giao diện thao tác chi tiết sẽ gắn trên trang việc làm.',
    to: '/jobs',
    action: 'Tìm việc để đánh giá',
  },
  {
    icon: WandSparkles,
    title: 'Tối ưu CV theo Job',
    description:
      'API tối ưu CV đã có trên backend. Frontend builder/optimize flow chưa được triển khai.',
    to: '/candidate/cvs',
    action: 'Xem thư viện CV',
  },
]

function CandidateAiCenterPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="Tổng hợp các khả năng AI của JOBHUB dành cho ứng viên."
        eyebrow="Ứng viên"
        title="Trung tâm AI"
      />

      <section className="rounded-xl border bg-hero px-5 py-5 text-hero-foreground">
        <div className="flex items-center gap-2 text-sm text-hero-muted">
          <Bot aria-hidden="true" className="size-4" />
          JOBHUB AI
        </div>
        <p className="mt-2 max-w-2xl text-sm text-hero-muted">
          Các tính năng dưới đây phản ánh API hiện có. Chỉ các luồng đã có giao diện mới được kích
          hoạt đầy đủ; không giả lập kết quả AI.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {AI_CAPABILITIES.map((item) => {
          const Icon = item.icon
          return (
            <article className="rounded-xl border bg-card p-5" key={item.title}>
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <h2 className="mt-4 text-base font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              <Button asChild className="mt-4" size="sm" variant="outline">
                <Link to={item.to}>{item.action}</Link>
              </Button>
            </article>
          )
        })}
      </div>
    </div>
  )
}

export default CandidateAiCenterPage
