import { ArrowLeft, Check, FilePlus2, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import CvCreateDraftForm from './CvCreateDraftForm'
import CvUploadForm from './CvUploadForm'

const METHODS = Object.freeze({
  DRAFT: 'draft',
  UPLOAD: 'upload',
})

const METHOD_CONFIG = {
  [METHODS.DRAFT]: {
    icon: FilePlus2,
    label: 'Tạo trên JOBHUB',
    shortLabel: 'Tạo trên JOBHUB',
    badge: 'Khuyến nghị',
    description: 'Tạo bản nháp trên hệ thống, chỉnh sửa rồi kích hoạt.',
    points: ['Chọn ngành nghề', 'Bổ sung nội dung sau', 'Kích hoạt khi sẵn sàng'],
  },
  [METHODS.UPLOAD]: {
    icon: Upload,
    label: 'Tải PDF lên',
    shortLabel: 'Tải PDF',
    badge: null,
    description: 'Thêm CV PDF có sẵn vào thư viện ứng tuyển.',
    points: ['Chỉ nhận PDF', 'Tối đa 10 MB · 20 trang', 'Không có mật khẩu'],
  },
}

function MethodListItem({ id, active, onSelect }) {
  const config = METHOD_CONFIG[id]
  const Icon = config.icon

  return (
    <button
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        active
          ? 'bg-primary/8 text-foreground ring-1 ring-primary/30'
          : 'text-foreground hover:bg-secondary/80',
      )}
      onClick={onSelect}
      type="button"
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors',
          active
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-muted-foreground',
        )}
      >
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold tracking-tight">{config.label}</span>
          {config.badge ? (
            <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {config.badge}
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {config.description}
        </span>
      </span>
    </button>
  )
}

function MethodSegment({ id, active, onSelect }) {
  const config = METHOD_CONFIG[id]
  const Icon = config.icon

  return (
    <button
      aria-pressed={active}
      className={cn(
        'flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        active
          ? 'bg-background text-foreground shadow-xs ring-1 ring-border'
          : 'text-muted-foreground hover:text-foreground',
      )}
      onClick={onSelect}
      type="button"
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate text-sm font-semibold">{config.shortLabel}</span>
    </button>
  )
}

function CandidateCvCreate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialMethod =
    searchParams.get('method') === METHODS.UPLOAD ? METHODS.UPLOAD : METHODS.DRAFT
  const [method, setMethod] = useState(initialMethod)

  const handleCreated = () => {
    navigate('/candidate/cvs')
  }

  const handleCancel = () => {
    navigate('/candidate/cvs')
  }

  const activeConfig = METHOD_CONFIG[method]
  const ActiveIcon = activeConfig.icon

  return (
    <div className="flex min-h-[min(34rem,calc(100svh-9.5rem))] flex-col overflow-hidden rounded-2xl border bg-card sm:min-h-[min(38rem,calc(100svh-10.5rem))] sm:rounded-3xl">
      <header className="shrink-0 border-b px-3 py-3 sm:px-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button asChild className="shrink-0 px-2 sm:px-3" size="sm" variant="ghost">
            <Link to="/candidate/cvs">
              <ArrowLeft aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Quản lý CV</span>
              <span className="sr-only sm:hidden">Quay lại quản lý CV</span>
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold tracking-tight sm:text-lg">Tạo CV mới</h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              Chọn phương thức và hoàn tất thông tin CV.
            </p>
          </div>
        </div>
      </header>

      <div className="shrink-0 border-b px-3 py-2.5 lg:hidden">
        <div
          aria-label="Chọn phương thức tạo CV"
          className="flex gap-1 rounded-xl bg-secondary/70 p-1"
          role="toolbar"
        >
          {Object.values(METHODS).map((id) => (
            <MethodSegment
              active={method === id}
              id={id}
              key={id}
              onSelect={() => setMethod(id)}
            />
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="hidden min-h-0 w-[17rem] shrink-0 flex-col border-r bg-background/40 xl:w-[18.75rem] lg:flex">
          <div className="shrink-0 px-4 pt-4 pb-2">
            <p className="text-sm font-semibold tracking-tight">Phương thức</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Chọn cách thêm CV</p>
          </div>

          <nav aria-label="Phương thức tạo CV" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            <ul className="space-y-1.5">
              {Object.values(METHODS).map((id) => (
                <li key={id}>
                  <MethodListItem
                    active={method === id}
                    id={id}
                    onSelect={() => setMethod(id)}
                  />
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          <div className="shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4">
            <div className="mx-auto flex w-full max-w-[45rem] items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ActiveIcon aria-hidden="true" className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold tracking-tight sm:text-base">
                    {activeConfig.label}
                  </h2>
                  {activeConfig.badge ? (
                    <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {activeConfig.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  {activeConfig.description}
                </p>
                <ul className="mt-2.5 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
                  {activeConfig.points.map((point) => (
                    <li
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                      key={point}
                    >
                      <Check aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
            <div className="mx-auto w-full max-w-[45rem]">
              {method === METHODS.DRAFT ? (
                <CvCreateDraftForm
                  formId="cv-create-page-form"
                  idPrefix="create-page"
                  onCancel={handleCancel}
                  onCreated={handleCreated}
                />
              ) : (
                <CvUploadForm
                  formId="cv-upload-page-form"
                  idPrefix="upload-page"
                  onCancel={handleCancel}
                  onCreated={handleCreated}
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default CandidateCvCreate
