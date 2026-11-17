import { FileSearch, WandSparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

const AI_TOOLS = [
  {
    icon: FileSearch,
    title: 'Đánh giá CV theo công việc',
    description:
      'Chọn một việc làm và nhận điểm phù hợp, nhận xét theo tiêu chí cùng gợi ý cải thiện CV.',
    to: '/candidate/ai-center/evaluate',
    action: 'Đánh giá CV',
  },
  {
    icon: WandSparkles,
    title: 'Tối ưu CV theo công việc',
    description:
      'Dựa trên kết quả đánh giá, tạo bản nháp CV Generated tối ưu hơn cho đúng việc làm mục tiêu.',
    to: '/candidate/ai-center/optimize',
    action: 'Tối ưu CV',
  },
]

function AiToolsGrid() {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">Công cụ AI</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">Phân tích và tối ưu CV</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          So sánh CV với một việc cụ thể hoặc tạo bản nháp tối ưu theo job.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {AI_TOOLS.map((item) => {
          const Icon = item.icon
          return (
            <article
              className="flex h-full flex-col rounded-2xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm sm:p-6"
              key={item.title}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                {item.description}
              </p>
              <Button asChild className="mt-5 w-full sm:w-auto" size="sm" variant="outline">
                <Link to={item.to}>{item.action}</Link>
              </Button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default AiToolsGrid
