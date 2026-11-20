import {
  CircleAlert,
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
  unsetOwnCandidateCvDefaultApi,
  updateOwnCandidateCvMetadataApi,
} from '@/apis/candidate-cv.api'
import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import ProfileModal from '@/features/candidate-profile/components/ProfileModal'
import { cn } from '@/lib/utils'
import { CANDIDATE_CV_VISIBILITY } from '@/utils/constant'

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
      } catch (setDefaultError) {
        toast.error(setDefaultError.message || 'Không đặt được CV mặc định')
      }
    })
  }

  const handleUnsetDefault = async (cv) => {
    await withBusy(cv.id, async () => {
      try {
        const response = await unsetOwnCandidateCvDefaultApi(cv.id)
        upsertCv(response.cv ?? { ...cv, isDefault: false })
        toast.success('Đã bỏ đặt CV mặc định')
      } catch (unsetError) {
        toast.error(unsetError.message || 'Không bỏ được CV mặc định')
      }
    })
  }

  const handleToggleVisibility = async (cv) => {
    const nextVisibility =
      cv.visibility === CANDIDATE_CV_VISIBILITY.PUBLIC
        ? CANDIDATE_CV_VISIBILITY.PRIVATE
        : CANDIDATE_CV_VISIBILITY.PUBLIC

    await withBusy(cv.id, async () => {
      try {
        const response = await updateOwnCandidateCvMetadataApi(cv.id, {
          visibility: nextVisibility,
        })
        upsertCv(response.cv ?? { ...cv, visibility: nextVisibility })
        toast.success(
          nextVisibility === CANDIDATE_CV_VISIBILITY.PUBLIC
            ? 'Đã chuyển CV sang Công khai'
            : 'Đã chuyển CV sang Riêng tư',
        )
      } catch (visibilityError) {
        toast.error(visibilityError.message || 'Không đổi được chế độ hiển thị CV')
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

  const handleConfirmArchive = async (cv) => {
    await withBusy(cv.id, async () => {
      try {
        await archiveOwnCandidateCvApi(cv.id)
        removeCv(cv.id)
        setDialog(null)
        toast.success('Đã xóa CV khỏi thư viện')
      } catch (archiveError) {
        toast.error(archiveError.message || 'Không xóa được CV')
      }
    })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">CV của tôi</h1>
            {!loading && !error && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {stats.total} CV
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Quản lý thư viện CV của bạn: tải lên PDF, tạo CV trên JOBHUB và đặt CV mặc định để ứng
            tuyển hoặc nhận gợi ý việc làm AI.
          </p>

          {!loading && !error && cvs.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span>
                Đang dùng: <strong className="font-semibold text-foreground">{stats.active}</strong>
              </span>
              <span>
                Bản nháp: <strong className="font-semibold text-foreground">{stats.draft}</strong>
              </span>
              {stats.defaultCv ? (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Star aria-hidden="true" className="size-3.5 fill-current" />
                  Mặc định:{' '}
                  <strong className="font-semibold text-foreground">{stats.defaultCv.name}</strong>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-warning-foreground">
                  <CircleAlert aria-hidden="true" className="size-3.5" />
                  Chưa chọn CV mặc định cho Gợi ý việc làm AI
                </span>
              )}
            </div>
          )}
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
      </header>

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
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc danh sách CV">
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
                      'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
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

            <label className="relative block sm:w-64 md:w-72">
              <span className="sr-only">Tìm CV</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                className="h-9 w-full rounded-xl border bg-background pr-9 pl-9 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm theo tên CV…"
                value={searchInput}
              />
              {searchInput ? (
                <Button
                  aria-label="Xóa tìm kiếm"
                  className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
                  onClick={() => setSearchInput('')}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </Button>
              ) : null}
            </label>
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
            <ul className="flex flex-col gap-3">
              {visibleCvs.map((cv) => (
                <li key={cv.id}>
                  <CvCard
                    busy={busyId === cv.id}
                    cv={cv}
                    onActivate={handleActivate}
                    onArchive={(item) => setDialog({ type: 'archive', cv: item })}
                    onDownload={handleDownload}
                    onEditMetadata={(item) => setDialog({ type: 'edit', cv: item })}
                    onPreview={(item) => setDialog({ type: 'preview', cv: item })}
                    onReplaceFile={(item) => setDialog({ type: 'replace', cv: item })}
                    onSetDefault={handleSetDefault}
                    onToggleVisibility={handleToggleVisibility}
                    onUnsetDefault={handleUnsetDefault}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {dialog?.type === 'edit' ? (
        <CvEditMetadataModal
          cv={dialog.cv}
          onClose={() => setDialog(null)}
          onUpdated={(cv) => {
            upsertCv(cv)
          }}
        />
      ) : null}

      {dialog?.type === 'replace' ? (
        <CvReplaceFileModal
          cv={dialog.cv}
          onClose={() => setDialog(null)}
          onUpdated={(cv) => {
            upsertCv(cv)
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

      {dialog?.type === 'archive' ? (
        <ProfileModal
          busy={busyId === dialog.cv.id}
          description="Thao tác này sẽ lưu trữ (archive) CV khỏi thư viện của bạn và không thể hoàn tác từ giao diện hiện tại."
          footer={
            <>
              <Button
                disabled={busyId === dialog.cv.id}
                onClick={() => setDialog(null)}
                type="button"
                variant="outline"
              >
                Hủy
              </Button>
              <Button
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={busyId === dialog.cv.id}
                onClick={() => handleConfirmArchive(dialog.cv)}
                type="button"
              >
                {busyId === dialog.cv.id ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                ) : null}
                Xóa khỏi thư viện
              </Button>
            </>
          }
          onClose={() => setDialog(null)}
          title="Xóa CV khỏi thư viện?"
        >
          <p className="text-sm text-muted-foreground">
            Bạn có chắc chắn muốn xóa CV{' '}
            <strong className="font-semibold text-foreground">“{dialog.cv.name}”</strong> khỏi thư
            viện?
          </p>
        </ProfileModal>
      ) : null}
    </div>
  )
}

export default CandidateCvManagement
