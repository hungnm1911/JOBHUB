import { ArrowRight, CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

const foundations = [
  'Routing với nested layout',
  'Redux Toolkit store dùng chung',
  'Axios client và chuẩn hóa lỗi',
  'Socket.IO client kết nối theo nhu cầu',
]

function HomePage() {
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">
      <div className="max-w-2xl">
        <span className="inline-flex rounded-full border bg-card px-3 py-1 text-sm font-medium text-muted-foreground shadow-sm">
          Nền tảng tuyển dụng JOBHUB
        </span>
        <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-6xl">
          Frontend đã sẵn sàng để phát triển theo từng tính năng.
        </h1>
        <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-muted-foreground">
          Bộ khung tối thiểu đã tách rõ UI, routing, global state, HTTP và
          realtime để các module nghiệp vụ có thể được bổ sung mà không tạo
          nguồn sự thật song song.
        </p>
        <div className="mt-8">
          <Button asChild size="lg">
            <a href="#foundation">
              Xem nền tảng kỹ thuật
              <ArrowRight aria-hidden="true" className="size-4" />
            </a>
          </Button>
        </div>
      </div>

      <div
        className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8"
        id="foundation"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Base architecture
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          Các lớp nền đã hoạt động
        </h2>
        <ul className="mt-6 space-y-4">
          {foundations.map((foundation) => (
            <li className="flex items-center gap-3" key={foundation}>
              <CheckCircle2
                aria-hidden="true"
                className="size-5 shrink-0 text-primary"
              />
              <span className="text-muted-foreground">{foundation}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default HomePage
