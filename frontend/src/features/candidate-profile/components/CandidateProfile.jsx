import {
  ArrowRight,
  Cake,
  CircleX,
  FileText,
  KeyRound,
  LoaderCircle,
  Mail,
  Pencil,
  Phone,
  RotateCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import { getInitials } from '@/features/authentication/utils'
import { formatDate } from '@/features/candidate-dashboard/utils'

import useCandidateProfile from '../hooks/useCandidateProfile'
import ChangePasswordModal from './ChangePasswordModal'
import ProfileBasicEditModal from './ProfileBasicEditModal'

function isUsableAvatarUrl(url) {
  if (!url || typeof url !== 'string') {
    return false
  }
  return !/dicebear\.com|ui-avatars\.com|robohash\.org/i.test(url)
}

function ProfileFieldRow({ icon: Icon, label, value, muted = false, note = null }) {
  return (
    <div className="flex items-start gap-3.5 rounded-xl border bg-background/60 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd
          className={
            muted
              ? 'mt-0.5 text-sm text-muted-foreground italic'
              : 'mt-0.5 text-sm font-semibold break-words text-foreground'
          }
        >
          {value}
        </dd>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      </div>
    </div>
  )
}

function CandidateProfile() {
  const { loading, error, profile, reload, setLocalProfile } = useCandidateProfile()
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)

  if (loading) {
    return (
      <CenteredState
        icon={LoaderCircle}
        spinning
        title="Đang tải hồ sơ cá nhân…"
        tone="bg-primary/10 text-primary"
      />
    )
  }

  if (error) {
    return (
      <CenteredState
        action={
          <Button onClick={reload} variant="outline">
            <RotateCw aria-hidden="true" className="size-4" />
            Thử lại
          </Button>
        }
        description={error.message}
        icon={CircleX}
        title="Không tải được hồ sơ cá nhân"
        tone="bg-secondary text-muted-foreground"
      />
    )
  }

  const avatarUrl = profile?.avatarUrl
  const showAvatar = isUsableAvatarUrl(avatarUrl) && !avatarFailed
  const initials = getInitials(profile?.fullName)
  const formattedDob = formatDate(profile?.dateOfBirth)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link className="hover:text-foreground hover:underline" to="/">
              Trang chủ
            </Link>
            <span aria-hidden="true"> › </span>
            <span className="text-foreground">Hồ sơ cá nhân</span>
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Hồ sơ cá nhân</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Quản lý thông tin định danh tài khoản ứng viên và bảo mật đăng nhập của bạn.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setChangePasswordOpen(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            <KeyRound aria-hidden="true" className="size-4" />
            Đổi mật khẩu
          </Button>
          <Button onClick={() => setEditProfileOpen(true)} size="sm" type="button">
            <Pencil aria-hidden="true" className="size-4" />
            Chỉnh sửa thông tin
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section
          aria-labelledby="candidate-identity-heading"
          className="rounded-2xl border bg-card p-5 sm:p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-primary text-lg font-bold text-primary-foreground sm:size-24">
              {showAvatar ? (
                <img
                  alt=""
                  className="size-full object-cover"
                  onError={() => setAvatarFailed(true)}
                  src={avatarUrl}
                />
              ) : (
                initials || <UserRound aria-hidden="true" className="size-8" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                Tài khoản Ứng viên
              </span>
              <h2 className="mt-1.5 truncate text-xl font-bold tracking-tight sm:text-2xl" id="candidate-identity-heading">
                {profile?.fullName || 'Ứng viên'}
              </h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </div>

          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <ProfileFieldRow
              icon={UserRound}
              label="Họ và tên"
              muted={!profile?.fullName}
              value={profile?.fullName || 'Chưa cập nhật'}
            />
            <ProfileFieldRow
              icon={Mail}
              label="Email đăng nhập"
              note="Email định danh tài khoản (chỉ đọc)"
              value={profile?.email || '—'}
            />
            <ProfileFieldRow
              icon={Phone}
              label="Số điện thoại"
              muted={!profile?.phoneNumber}
              value={profile?.phoneNumber || 'Chưa cập nhật số điện thoại'}
            />
            <ProfileFieldRow
              icon={Cake}
              label="Ngày sinh"
              muted={!formattedDob}
              value={formattedDob || 'Chưa cập nhật ngày sinh'}
            />
          </dl>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck aria-hidden="true" className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Bảo mật tài khoản</h2>
                <p className="text-xs text-muted-foreground">Mật khẩu &amp; phiên đăng nhập</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Đổi mật khẩu định kỳ để bảo vệ tài khoản. Khi đổi mật khẩu, tất cả các thiết bị đang
              đăng nhập sẽ tự động đăng xuất.
            </p>
            <Button
              className="mt-4 w-full"
              onClick={() => setChangePasswordOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <KeyRound aria-hidden="true" className="size-4" />
              Đổi mật khẩu
            </Button>
          </section>

          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <FileText aria-hidden="true" className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Hồ sơ nghề nghiệp &amp; CV</h2>
                <p className="text-xs text-muted-foreground">Tách biệt với thông tin tài khoản</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Theo thiết kế của JOBHUB, kinh nghiệm làm việc, học vấn, kỹ năng, dự án và chứng chỉ
              được quản lý riêng trong từng CV tại <strong>Quản lý CV</strong> (để bạn có thể tạo
              nhiều CV cho các vị trí khác nhau).
            </p>
            <Button asChild className="mt-4 w-full" size="sm">
              <Link to="/candidate/cvs">
                Đi tới Quản lý CV
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </section>
        </aside>
      </div>

      {editProfileOpen && (
        <ProfileBasicEditModal
          onClose={() => setEditProfileOpen(false)}
          onSaved={(nextProfile) => {
            setAvatarFailed(false)
            setLocalProfile(nextProfile)
          }}
          profile={profile}
        />
      )}

      {changePasswordOpen && (
        <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />
      )}
    </div>
  )
}

export default CandidateProfile
