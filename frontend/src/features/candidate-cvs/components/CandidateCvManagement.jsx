import {
  CircleX,
  FilePlus2,
  FileText,
  LoaderCircle,
  RotateCw,
  Search,
  Star,
  Upload,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import {
  activateOwnGeneratedCandidateCvApi,
  archiveOwnCandidateCvApi,
  downloadOwnCandidateCvApi,
  setOwnCandidateCvAsDefaultApi,
} from '@/apis/candidate-cv.api'
import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import useCandidateCvs from '../hooks/useCandidateCvs'
import {
  CV_LIST_FILTER,
  CV_LIST_FILTER_LABEL,
  computeCvLibraryStats,
  fileNameFromContentDisposition,
  matchesCvFilter,
  matchesCvSearch,
  triggerBlobDownload,
} from '../utils'
import CvCard from './CvCard'
import CvEditMetadataModal from './CvEditMetadataModal'
import CvPreviewModal from './CvPreviewModal'
import CvReplaceFileModal from './CvReplaceFileModal'

function StatPill({ label, value, tone = 'default' }) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3',
        tone === 'primary' ? 'border-primary/20 bg-primary/5' : 'bg-card',
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function CandidateCvManagement() {
  const { loading, cvs, error, reload, upsertCv, removeCv } = useCandidateCvs()
  const [busyId, setBusyId] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [filter, setFilter] = useState(CV_LIST_FILTER.ALL)

  const stats = useMemo(() => computeCvLibraryStats(cvs), [cvs])

  const filterCounts = useMemo(() => {
    const counts = Object.fromEntries(
      Object.values(CV_LIST_FILTER).map((option) => [option, 0]),
    )
    counts[CV_LIST_FILTER.ALL] = cvs.length
    for (const cv of cvs) {
      for (const option of Object.values(CV_LIST_FILTER)) {
        if (option !== CV_LIST_FILTER.ALL && matchesCvFilter(cv, option)) {
          counts[option] += 1
        }
      }
    }
    return counts
  }, [cvs])

  const visibleCvs = useMemo(
    () =>
      cvs.filter(
        (cv) => matchesCvFilter(cv, filter) && matchesCvSearch(cv, searchInput),
      ),
    [cvs, filter, searchInput],
  )

  const withBusy = async (cvId, action) => {
    setBusyId(cvId)
    try {
      await action()
    } finally {
      setBusyId(null)
    }
  }

  const handleDownload = async (cv) => {
    await withBusy(cv.id, async () => {
      try {
        const response = await downloadOwnCandidateCvApi(cv.id)
        const disposition = response.headers?.['content-disposition']
        triggerBlobDownload(
          response.data,
          fileNameFromContentDisposition(disposition, `${cv.name || 'cv'}.pdf`),
        )
        toast.success('Đã tải CV')
      } catch (downloadError) {
        toast.error(downloadError.message || 'Không tải được CV')
      }
    })
  }

  const handleSetDefault = async (cv) => {
    await withBusy(cv.id, async () => {
      try {
        const response = await setOwnCandidateCvAsDefaultApi(cv.id)
        const nextDefault = response.cv
        cvs.forEach((item) => {
          if (item.isDefault && item.id !== nextDefault.id) {
            upsertCv({ ...item, isDefault: false })
          }
        })
        upsertCv(nextDefault)
        toast.success('Đã đặt CV mặc định')
        reload()
      } catch (setDefaultError) {
        toast.error(setDefaultError.message || 'Không đặt được CV mặc định')
      }
    })
  }

  const handleActivate = async (cv) => {
    await withBusy(cv.id, async () => {
      try {
        const response = await activateOwnGeneratedCandidateCvApi(cv.id)
        upsertCv(response.cv)
        toast.success('Đã kích hoạt CV')
      } catch (activateError) {
        toast.error(
          activateError.message ||
            'Không kích hoạt được CV. Kiểm tra nội dung đã đủ điều kiện chưa.',
        )
      }
    })
  }

  const handleArchive = async (cv) => {
    if (
      !window.confirm(
        `Bạn chắc chắn muốn xóa “${cv.name}” khỏi thư viện CV? Thao tác này lưu trữ (archive) CV, không khôi phục từ giao diện hiện tại.`,
      )
    ) {
      return
    }

    await withBusy(cv.id, async () => {
      try {
        await archiveOwnCandidateCvApi(cv.id)
        removeCv(cv.id)
        toast.success('Đã xóa CV khỏi thư viện')
      } catch (archiveError) {
        toast.error(archiveError.message || 'Không xóa được CV')
      }
    })
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border bg-card">
        <div className="bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_55%)] px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <FileText aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                    Thư viện CV
                  </p>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">CV của tôi</h1>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Quản lý CV đang dùng: tải PDF, tạo bản nháp trên JOBHUB, xem trước và đặt CV mặc định
                cho ứng tuyển.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/candidate/cvs/create?method=upload">
                  <Upload aria-hidden="true" className="size-4" />
                  Upload CV
                </Link>
              </Button>
              <Button asChild>
                <Link to="/candidate/cvs/create">
                  <FilePlus2 aria-hidden="true" className="size-4" />
                  Tạo CV mới
                </Link>
              </Button>
            </div>
          </div>

          {!loading && !error ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <StatPill label="Tổng CV" value={stats.total} />
              <StatPill label="Đang dùng" tone="primary" value={stats.active} />
              <StatPill label="Bản nháp" value={stats.draft} />
            </div>
          ) : null}

          {!loading && !error && stats.defaultCv ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/15 bg-background/80 px-4 py-3 text-sm">
              <Star aria-hidden="true" className="size-4 text-primary" />
              <span className="text-muted-foreground">CV mặc định:</span>
              <span className="font-medium">{stats.defaultCv.name}</span>
            </div>
          ) : null}
        </div>
      </section>

      {loading ? (
        <CenteredState
          icon={LoaderCircle}
          spinning
          title="Đang tải danh sách CV…"
          tone="bg-primary/10 text-primary"
        />
      ) : null}

      {!loading && error ? (
        <CenteredState
          action={
            <Button onClick={reload} variant="outline">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          }
          description="Không tải được danh sách CV. Vui lòng thử lại."
          icon={CircleX}
          title="Không tải được CV"
          tone="bg-secondary text-muted-foreground"
        />
      ) : null}

      {!loading && !error && cvs.length === 0 ? (
        <CenteredState
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline">
                <Link to="/candidate/cvs/create?method=upload">
                  <Upload aria-hidden="true" className="size-4" />
                  Upload CV
                </Link>
              </Button>
              <Button asChild>
                <Link to="/candidate/cvs/create">
                  <FilePlus2 aria-hidden="true" className="size-4" />
                  Tạo CV mới
                </Link>
              </Button>
            </div>
          }
          description="Bạn chưa có CV trong thư viện. Hãy tải lên PDF hoặc tạo bản nháp trên JOBHUB."
          icon={FileText}
          title="Chưa có CV"
          tone="bg-secondary text-muted-foreground"
        />
      ) : null}

      {!loading && !error && cvs.length > 0 ? (
        <section className="space-y-4">
          <div className="rounded-2xl border bg-card p-3 sm:p-4">
            <label className="relative block">
              <span className="sr-only">Tìm CV</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                className="h-11 w-full rounded-xl border-0 bg-secondary/80 pr-10 pl-9 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm theo tên CV…"
                value={searchInput}
              />
              {searchInput ? (
                <Button
                  aria-label="Xóa tìm kiếm"
                  className="absolute top-1/2 right-1 size-8 -translate-y-1/2"
                  onClick={() => setSearchInput('')}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              ) : null}
            </label>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.values(CV_LIST_FILTER).map((option) => {
                const active = filter === option
                const count = filterCounts[option] ?? 0
                if (option !== CV_LIST_FILTER.ALL && count === 0 && filter !== option) {
                  return null
                }
                return (
                  <button
                    aria-pressed={active}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground hover:text-foreground',
                    )}
                    key={option}
                    onClick={() => setFilter(option)}
                    type="button"
                  >
                    {CV_LIST_FILTER_LABEL[option]}
                    <span
                      className={cn(
                        'inline-flex min-w-4 justify-center rounded-full px-1 text-[10px] font-semibold',
                        active
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-background/80 text-muted-foreground',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {visibleCvs.length === 0 ? (
            <CenteredState
              action={
                <Button
                  onClick={() => {
                    setFilter(CV_LIST_FILTER.ALL)
                    setSearchInput('')
                  }}
                  variant="outline"
                >
                  Xóa bộ lọc
                </Button>
              }
              description="Thử đổi từ khóa hoặc chọn bộ lọc khác."
              icon={Search}
              title="Không tìm thấy CV phù hợp"
              tone="bg-secondary text-muted-foreground"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleCvs.map((cv) => (
                <CvCard
                  busy={busyId === cv.id}
                  cv={cv}
                  key={cv.id}
                  onActivate={handleActivate}
                  onArchive={handleArchive}
                  onDownload={handleDownload}
                  onEditMetadata={(item) => setDialog({ type: 'edit', cv: item })}
                  onPreview={(item) => setDialog({ type: 'preview', cv: item })}
                  onReplaceFile={(item) => setDialog({ type: 'replace', cv: item })}
                  onSetDefault={handleSetDefault}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {dialog?.type === 'edit' ? (
        <CvEditMetadataModal
          cv={dialog.cv}
          onClose={() => setDialog(null)}
          onUpdated={(cv) => {
            upsertCv(cv)
            reload()
          }}
        />
      ) : null}

      {dialog?.type === 'replace' ? (
        <CvReplaceFileModal
          cv={dialog.cv}
          onClose={() => setDialog(null)}
          onUpdated={(cv) => {
            upsertCv(cv)
            reload()
          }}
        />
      ) : null}

      {dialog?.type === 'preview' ? (
        <CvPreviewModal
          cv={dialog.cv}
          key={dialog.cv.id}
          onClose={() => setDialog(null)}
          onDownload={handleDownload}
        />
      ) : null}
    </div>
  )
}

export default CandidateCvManagement
