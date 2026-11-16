import { ArrowLeft, FilePlus2, Upload } from 'lucide-react'
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

function MethodCard({ active, icon: Icon, title, description, points, onSelect, actionLabel }) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        'flex h-full flex-col rounded-xl border bg-card p-5 text-left transition-colors',
        active
          ? 'border-primary ring-2 ring-primary/20'
          : 'hover:border-primary/40 hover:bg-primary/5',
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <h2 className="mt-4 text-base font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
        {points.map((point) => (
          <li key={point}>• {point}</li>
        ))}
      </ul>
      <span className="mt-5 inline-flex text-sm font-medium text-primary">{actionLabel}</span>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link className="hover:text-foreground hover:underline" to="/candidate/cvs">
              Quản lý CV
            </Link>
            <span aria-hidden="true"> › </span>
            <span className="text-foreground">Tạo CV mới</span>
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Tạo CV mới</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Chọn phương thức tạo CV được JOBHUB hỗ trợ hiện tại: tải PDF lên hoặc tạo bản nháp
            Generated trên hệ thống.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/candidate/cvs">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Về danh sách CV
          </Link>
        </Button>
      </div>

      <section className="rounded-2xl border bg-primary/5 px-5 py-6 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Phương thức tạo CV
        </p>
        <h2 className="mt-2 text-xl font-bold tracking-tight">Chọn cách bắt đầu</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Bạn có thể tạo bản nháp CV trên JOBHUB hoặc tải lên file PDF sẵn có để lưu vào thư viện.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <MethodCard
          actionLabel="Bắt đầu tạo bản nháp →"
          active={method === METHODS.DRAFT}
          description="Khởi tạo CV Generated dạng bản nháp với metadata cơ bản trên JOBHUB."
          icon={FilePlus2}
          onSelect={() => setMethod(METHODS.DRAFT)}
          points={[
            'Tạo bản nháp qua API CV Generated',
            'Chọn ngành nghề và chế độ hiển thị',
            'Bổ sung nội dung rồi kích hoạt khi đủ điều kiện',
          ]}
          title="Tạo CV trên JOBHUB"
        />
        <MethodCard
          actionLabel="Bắt đầu tải lên →"
          active={method === METHODS.UPLOAD}
          description="Tải CV PDF hiện có vào thư viện. Backend kiểm tra PDF thật, dung lượng và số trang."
          icon={Upload}
          onSelect={() => setMethod(METHODS.UPLOAD)}
          points={[
            'Chỉ nhận PDF chuẩn',
            'Tối đa 10 MB và 20 trang',
            'Không chấp nhận PDF bảo vệ mật khẩu',
          ]}
          title="Tải CV PDF lên"
        />
      </div>

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        {method === METHODS.DRAFT ? (
          <>
            <h2 className="text-base font-semibold">Tạo bản nháp CV Generated</h2>
            <div className="mt-4">
              <CvCreateDraftForm
                formId="cv-create-page-form"
                idPrefix="create-page"
                onCreated={handleCreated}
              />
            </div>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold">Upload CV PDF</h2>
            <div className="mt-4">
              <CvUploadForm
                formId="cv-upload-page-form"
                idPrefix="upload-page"
                onCreated={handleCreated}
              />
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default CandidateCvCreate
