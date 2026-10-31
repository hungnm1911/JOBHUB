import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import employerImage from '@/assets/showcase/employer.jpg'
import filterImage from '@/assets/showcase/filter.jpg'
import searchImage from '@/assets/showcase/search.jpg'
import verifiedImage from '@/assets/showcase/verified.jpg'
import { cn } from '@/lib/utils'

const AUTO_ADVANCE_MS = 6_000

const slides = [
  {
    tag: 'Tìm việc theo từ khóa',
    title: 'Tìm đúng công việc chỉ với vài từ khóa',
    description: 'Tìm theo tên vị trí, kỹ năng yêu cầu, tên công ty hoặc nội dung mô tả công việc.',
    image: searchImage,
  },
  {
    tag: 'Danh mục chuẩn hóa',
    title: 'Lọc theo ngành nghề và địa điểm',
    description: 'Ngành nghề và tỉnh/thành được chuẩn hóa trên toàn hệ thống để kết quả chính xác hơn.',
    image: filterImage,
  },
  {
    tag: 'Doanh nghiệp đã xác minh',
    title: 'Tin tuyển dụng từ doanh nghiệp đã được phê duyệt',
    description: 'Việc làm chỉ được công khai khi doanh nghiệp đăng tuyển đã được duyệt và đang hoạt động.',
    image: verifiedImage,
  },
  {
    tag: 'Dành cho nhà tuyển dụng',
    title: 'Đưa doanh nghiệp của bạn lên JOBHUB',
    description: 'Đăng ký tài khoản doanh nghiệp, hoàn thiện hồ sơ và gửi duyệt để bắt đầu tuyển dụng.',
    image: employerImage,
    action: { to: '/register/company', label: 'Đăng ký doanh nghiệp' },
  },
]

function usePrefersReducedMotion() {
  const [reduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )
  return reduced
}

function PlatformShowcaseCarousel() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (paused || reducedMotion) {
      return undefined
    }

    const timer = window.setInterval(
      () => setActiveIndex((current) => (current + 1) % slides.length),
      AUTO_ADVANCE_MS,
    )

    return () => window.clearInterval(timer)
  }, [paused, reducedMotion])

  const goTo = (index) => setActiveIndex((index + slides.length) % slides.length)

  return (
    <section
      aria-label="Giới thiệu JOBHUB"
      aria-roledescription="carousel"
      className="relative min-h-80 overflow-hidden rounded-2xl bg-hero text-hero-foreground"
      onBlur={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((slide, index) => {
        const active = index === activeIndex

        return (
          <div
            aria-hidden={!active}
            aria-label={`${index + 1} / ${slides.length}`}
            aria-roledescription="slide"
            className={cn(
              'absolute inset-0 flex transition-opacity duration-700',
              active ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
            inert={!active}
            key={slide.title}
            role="group"
          >
            <img
              alt=""
              className="absolute inset-0 size-full object-cover"
              decoding="async"
              loading={index === 0 ? 'eager' : 'lazy'}
              src={slide.image}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-hero via-hero/80 to-hero/10"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-hero/90 via-transparent to-transparent"
            />

            <div className="relative mt-auto max-w-xl px-14 pt-6 pb-10 sm:px-16">
              <span className="inline-flex rounded-md bg-primary px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground">
                {slide.tag}
              </span>
              <h2 className="mt-3 text-balance text-2xl font-bold tracking-tight sm:text-3xl">
                {slide.title}
              </h2>
              <p className="mt-2 text-pretty text-sm text-hero-muted sm:text-base">
                {slide.description}
              </p>
              {slide.action && (
                <Link
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-hero-foreground"
                  to={slide.action.to}
                >
                  {slide.action.label}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              )}
            </div>
          </div>
        )
      })}

      <button
        aria-label="Slide trước"
        className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-hero-foreground/15 backdrop-blur transition-colors hover:bg-hero-foreground/25 focus-visible:outline-2 focus-visible:outline-hero-foreground"
        onClick={() => goTo(activeIndex - 1)}
        type="button"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </button>
      <button
        aria-label="Slide sau"
        className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-hero-foreground/15 backdrop-blur transition-colors hover:bg-hero-foreground/25 focus-visible:outline-2 focus-visible:outline-hero-foreground"
        onClick={() => goTo(activeIndex + 1)}
        type="button"
      >
        <ChevronRight aria-hidden="true" className="size-5" />
      </button>

      <div className="absolute bottom-4 right-5 flex gap-1.5">
        {slides.map((slide, index) => (
          <button
            aria-current={index === activeIndex ? 'true' : undefined}
            aria-label={`Chuyển đến slide ${index + 1}`}
            className={cn(
              'h-1.5 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-hero-foreground',
              index === activeIndex ? 'w-6 bg-primary' : 'w-1.5 bg-hero-foreground/50',
            )}
            key={slide.title}
            onClick={() => goTo(index)}
            type="button"
          />
        ))}
      </div>
    </section>
  )
}

export default PlatformShowcaseCarousel
