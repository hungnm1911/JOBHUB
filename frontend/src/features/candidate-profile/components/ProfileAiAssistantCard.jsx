import { Bot, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

function ProfileAiAssistantCard({ completion, canEditContent }) {
  const nextSteps = completion.missing.slice(0, 3)
  const isComplete = nextSteps.length === 0

  return (
    <section className="rounded-xl border bg-hero p-5 text-hero-foreground">
      <div className="flex items-center gap-2 text-sm text-hero-muted">
        <Bot aria-hidden="true" className="size-4" />
        Gợi ý hồ sơ
      </div>
      <h2 className="mt-2 text-base font-semibold">
        {isComplete ? 'Hồ sơ đã khá đầy đủ' : `Hồ sơ đang hoàn thiện ${completion.percent}%`}
      </h2>
      <p className="mt-2 text-sm text-hero-muted">
        {isComplete
          ? 'Bạn đã hoàn thành các mục cơ bản. Có thể dùng Gợi ý việc làm AI để khám phá việc làm phù hợp.'
          : 'Dựa trên dữ liệu hồ sơ hiện có, bạn nên bổ sung các mục sau để tăng khả năng được liên hệ.'}
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-hero-muted">
        {isComplete ? (
          <li>• Duy trì CV mặc định và cập nhật kinh nghiệm định kỳ.</li>
        ) : (
          nextSteps.map((item) => <li key={item.key}>• Bổ sung {item.label.toLowerCase()}</li>)
        )}
      </ul>
      <p className="mt-3 text-xs text-hero-muted">
        Đây là gợi ý theo mức hoàn thiện hồ sơ, chưa phải kết quả phân tích AI.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90" size="sm">
          <Link to="/candidate/ai-jobs">
            <Sparkles aria-hidden="true" className="size-4" />
            Gợi ý việc làm
          </Link>
        </Button>
        {canEditContent && (
          <Button asChild size="sm" variant="outline">
            <Link
              className="border-hero-foreground/20 bg-transparent text-hero-foreground hover:bg-hero-foreground/10 hover:text-hero-foreground"
              to="/candidate/cvs"
            >
              Quản lý CV
            </Link>
          </Button>
        )}
      </div>
    </section>
  )
}

export default ProfileAiAssistantCard
