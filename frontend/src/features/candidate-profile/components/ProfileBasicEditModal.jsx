import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  updateOwnCandidateProfileApi,
  uploadOwnCandidateAvatarApi,
} from '@/apis/candidate-profile.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'
import useUnsavedChangesPrompt from '@/components/common/useUnsavedChangesPrompt'
import { COMPANY_IMAGE_ACCEPT } from '@/utils/constant'

import ProfileModal from './ProfileModal'

function toDateInputValue(value) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toISOString().slice(0, 10)
}

function ProfileBasicEditModal({ profile, onClose, onSaved }) {
  const avatarInputId = useId()
  const avatarInputRef = useRef(null)
  const [fullName, setFullName] = useState(profile?.fullName ?? '')
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(toDateInputValue(profile?.dateOfBirth))
  const [submitting, setSubmitting] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [error, setError] = useState(null)
  const [initial, setInitial] = useState(() => ({
    fullName: profile?.fullName ?? '',
    phoneNumber: profile?.phoneNumber ?? '',
    avatarUrl: profile?.avatarUrl ?? '',
    dateOfBirth: toDateInputValue(profile?.dateOfBirth),
  }))
  const isDirty = fullName !== initial.fullName ||
    phoneNumber !== initial.phoneNumber ||
    avatarUrl !== initial.avatarUrl ||
    dateOfBirth !== initial.dateOfBirth
  const { confirmDiscard, markSaved } = useUnsavedChangesPrompt(isDirty)
  const handleClose = () => confirmDiscard(onClose)

  const busy = submitting || uploadingAvatar
  const showAvatar = Boolean(avatarUrl) && !avatarFailed

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    setUploadingAvatar(true)
    setError(null)
    try {
      const response = await uploadOwnCandidateAvatarApi(file)
      const nextUrl = response.avatar?.url || response.profile?.avatarUrl || ''
      setInitial((current) => ({ ...current, avatarUrl: nextUrl }))
      setAvatarUrl(nextUrl)
      setAvatarFailed(false)
      if (response.profile) {
        onSaved(response.profile)
      }
      toast.success('Đã tải lên ảnh đại diện')
    } catch (uploadError) {
      setError(uploadError)
      toast.error(uploadError.message || 'Không tải được ảnh đại diện')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleClearAvatar = () => {
    setAvatarUrl('')
    setAvatarFailed(false)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await updateOwnCandidateProfileApi({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        dateOfBirth: dateOfBirth || null,
      })
      toast.success('Đã cập nhật hồ sơ')
      markSaved()
      onSaved(response.profile)
      onClose()
    } catch (saveError) {
      setError(saveError)
      toast.error(saveError.message || 'Không cập nhật được hồ sơ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ProfileModal
      busy={busy}
      description="Cập nhật thông tin tài khoản Candidate."
      footer={
        <>
          <Button disabled={busy} onClick={handleClose} type="button" variant="outline">
            Hủy
          </Button>
          <Button disabled={busy || !fullName.trim()} form="profile-basic-form" type="submit">
            {submitting && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </>
      }
      onClose={handleClose}
      title="Chỉnh sửa hồ sơ"
    >
      <form className="space-y-4" id="profile-basic-form" onSubmit={handleSubmit}>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">
            Họ và tên <span className="text-destructive">*</span>
          </span>
          <Input
            disabled={busy}
            maxLength={100}
            onChange={(event) => setFullName(event.target.value)}
            required
            value={fullName}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <Input disabled value={profile?.email ?? ''} />
          <span className="text-xs text-muted-foreground">Email chỉ đọc, không sửa qua API hồ sơ.</span>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Số điện thoại</span>
          <Input
            disabled={busy}
            maxLength={20}
            onChange={(event) => setPhoneNumber(event.target.value)}
            value={phoneNumber}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Ngày sinh</span>
          <Input
            disabled={busy}
            onChange={(event) => setDateOfBirth(event.target.value)}
            type="date"
            value={dateOfBirth}
          />
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium" id={`${avatarInputId}-label`}>
              Ảnh đại diện
            </span>
            {avatarUrl ? (
              <Button
                disabled={busy}
                onClick={handleClearAvatar}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Xóa
              </Button>
            ) : null}
          </div>

          <button
            aria-labelledby={`${avatarInputId}-label`}
            className="group relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-dashed bg-secondary/30 py-6 transition hover:border-primary/40 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
            disabled={busy}
            onClick={() => avatarInputRef.current?.click()}
            type="button"
          >
            {showAvatar ? (
              <img
                alt="Ảnh đại diện hiện tại"
                className="size-24 rounded-full object-cover"
                onError={() => setAvatarFailed(true)}
                src={avatarUrl}
              />
            ) : (
              <span className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                {uploadingAvatar ? (
                  <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary" />
                ) : (
                  <ImagePlus aria-hidden="true" className="size-6 text-primary" />
                )}
                {uploadingAvatar ? 'Đang tải lên…' : 'Chọn ảnh JPEG / PNG / WebP'}
              </span>
            )}
          </button>

          <input
            accept={COMPANY_IMAGE_ACCEPT}
            className="sr-only"
            disabled={busy}
            id={avatarInputId}
            onChange={handleAvatarChange}
            ref={avatarInputRef}
            type="file"
          />
          <p className="text-xs text-muted-foreground">
            Ảnh tải lên sẽ lưu ngay vào hồ sơ. Bạn vẫn có thể bấm Xóa rồi Lưu để gỡ avatar.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error.message}</p>}
      </form>
    </ProfileModal>
  )
}

export default ProfileBasicEditModal
