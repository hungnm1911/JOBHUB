import { TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'

function MarketInsightsCard() {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <TrendingUp aria-hidden="true" className="size-4 text-primary" />
        <h2 className="text-base font-semibold">Gợi ý khám phá thị trường</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Nội dung dưới đây là hướng dẫn sử dụng JOBHUB, không phải số liệu thống kê thị trường.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        <li>Dùng bộ lọc kỹ năng và địa điểm trên trang tìm việc để thu hẹp kết quả.</li>
        <li>Đặt một CV mặc định để dùng gợi ý việc làm AI khi sẵn sàng.</li>
        <li>Theo dõi đơn ứng tuyển và lời mời để phản hồi đúng hạn.</li>
      </ul>
      <Link
        className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
        to="/jobs"
      >
        Khám phá việc làm
      </Link>
    </section>
  )
}

export default MarketInsightsCard
