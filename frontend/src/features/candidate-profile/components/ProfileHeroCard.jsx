import { Cake, Mail, MapPin, Phone, UserRound } from 'lucide-react'
import { useState } from 'react'

import { getInitials } from '@/features/authentication/utils'
import { formatDate } from '@/features/candidate-dashboard/utils'

function ContactItem({ icon: Icon, children }) {
  if (!children) {
    return null
  }
  return (
    <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{children}</span>
    </p>
  )
}

function isUsableAvatarUrl(url) {
  if (!url || typeof url !== 'string') {
    return false
  }
  // Demo/placeholder generators are not part of JOBHUB brand presentation.
  return !/dicebear\.com|ui-avatars\.com|robohash\.org/i.test(url)
}

function ProfileHeroCard({ profile, content, completion }) {
  const [avatarFailed, setAvatarFailed] = useState(false)
  const title =
    content?.workExperiences?.find((item) => !item.endDate)?.position ||
    content?.workExperiences?.[0]?.position ||
    null
  const location = content?.personalInfo?.displayLocation
  const avatarUrl = profile?.avatarUrl || content?.personalInfo?.avatarUrl
  const showAvatar = isUsableAvatarUrl(avatarUrl) && !avatarFailed
  const initials = getInitials(profile?.fullName)

  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
          <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-primary text-lg font-bold text-primary-foreground sm:size-24">
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
            <h1 className="text-2xl font-bold tracking-tight">{profile?.fullName || 'Ứng viên'}</h1>
            {title && <p className="mt-1 text-sm font-medium text-primary">{title}</p>}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ContactItem icon={Mail}>{profile?.email}</ContactItem>
              <ContactItem icon={Phone}>{profile?.phoneNumber || 'Chưa cập nhật SĐT'}</ContactItem>
              <ContactItem icon={MapPin}>{location || 'Chưa cập nhật địa điểm'}</ContactItem>
              <ContactItem icon={Cake}>
                {formatDate(profile?.dateOfBirth) || 'Chưa cập nhật ngày sinh'}
              </ContactItem>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-72">
          <div className="rounded-lg border bg-muted/30 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Hoàn thiện hồ sơ</p>
              <p className="text-sm font-semibold text-primary">{completion.percent}%</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${completion.percent}%` }}
              />
            </div>
            {completion.missing[0] ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Gợi ý tiếp theo: {completion.missing[0].label}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Các mục cơ bản đã đầy đủ.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default ProfileHeroCard
