import { Link } from 'react-router-dom'

function ProfileCompletionCard({ completion }) {
  const { percent, nextSuggestion } = completion
  const circumference = 2 * Math.PI * 36
  const offset = circumference - (percent / 100) * circumference

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-4">
        <div className="relative size-20 shrink-0">
          <svg aria-hidden="true" className="size-20 -rotate-90" viewBox="0 0 80 80">
            <circle
              className="stroke-secondary"
              cx="40"
              cy="40"
              fill="none"
              r="36"
              strokeWidth="8"
            />
            <circle
              className="stroke-primary transition-[stroke-dashoffset]"
              cx="40"
              cy="40"
              fill="none"
              r="36"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              strokeWidth="8"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
            {percent}%
          </span>
        </div>

        <div className="min-w-0">
          <h2 className="text-base font-semibold">Hoàn thiện hồ sơ</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {percent >= 100
              ? 'Hồ sơ đã đủ các thông tin cơ bản.'
              : percent >= 70
                ? 'Sắp đạt mức tối đa!'
                : 'Bổ sung thông tin để tăng cơ hội được liên hệ.'}
          </p>
        </div>
      </div>

      {nextSuggestion && (
        <div className="mt-4 rounded-lg bg-muted/50 px-3 py-3">
          <p className="text-sm">
            {nextSuggestion.label}
            <span className="ml-1 text-muted-foreground">(+{nextSuggestion.weight}%)</span>
          </p>
          <Link
            className="mt-1 inline-flex text-sm font-medium text-primary hover:underline"
            to="/candidate/profile"
          >
            Cập nhật ngay
          </Link>
        </div>
      )}
    </section>
  )
}

export default ProfileCompletionCard
