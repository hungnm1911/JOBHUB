import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { updateOwnCandidateProfileApi } from '@/apis/candidate-profile.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'

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
  const [fullName, setFullName] = useState(profile?.fullName ?? '')
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(toDateInputValue(profile?.dateOfBirth))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

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
      busy={submitting}
      description="Cập nhật thông tin tài khoản Candidate (API /candidate/profile)."
      footer={
        <>
          <Button disabled={submitting} onClick={onClose} type="button" variant="outline">
            Hủy
          </Button>
          <Button disabled={submitting || !fullName.trim()} form="profile-basic-form" type="submit">
            {submitting && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </>
      }
      onClose={onClose}
      title="Chỉnh sửa hồ sơ"
    >
      <form className="space-y-4" id="profile-basic-form" onSubmit={handleSubmit}>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">
            Họ và tên <span className="text-destructive">*</span>
          </span>
          <Input
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
            maxLength={20}
            onChange={(event) => setPhoneNumber(event.target.value)}
            value={phoneNumber}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Ngày sinh</span>
          <Input
            onChange={(event) => setDateOfBirth(event.target.value)}
            type="date"
            value={dateOfBirth}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">URL ảnh đại diện</span>
          <Input
            maxLength={500}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://..."
            value={avatarUrl}
          />
        </label>
        {error && <p className="text-sm text-destructive">{error.message}</p>}
      </form>
    </ProfileModal>
  )
}

export default ProfileBasicEditModal
