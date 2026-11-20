import { ArrowLeft, FileCode2, FileText } from 'lucide-react'
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

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Button asChild className="shrink-0" size="icon-sm" variant="outline">
            <Link aria-label="Quay lại quản lý CV" to="/candidate/cvs">
              <ArrowLeft aria-hidden="true" className="size-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold tracking-tight">Tạo CV mới</h1>
        </div>

        <div
          aria-label="Chọn phương thức tạo CV"
          className="inline-flex rounded-xl border bg-card p-1"
          role="radiogroup"
        >
          <button
            aria-checked={method === METHODS.DRAFT}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all sm:text-sm',
              method === METHODS.DRAFT
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setMethod(METHODS.DRAFT)}
            role="radio"
            type="button"
          >
            <FileCode2 aria-hidden="true" className="size-4" />
            <span>Tạo trên JOBHUB</span>
          </button>

          <button
            aria-checked={method === METHODS.UPLOAD}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all sm:text-sm',
              method === METHODS.UPLOAD
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setMethod(METHODS.UPLOAD)}
            role="radio"
            type="button"
          >
            <FileText aria-hidden="true" className="size-4" />
            <span>Tải lên PDF</span>
          </button>
        </div>
      </header>

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
  )
}

export default CandidateCvCreate
