import {
  Building2,
  ExternalLink,
  FileBadge,
  Globe,
  Image as ImageIcon,
  MapPin,
  Phone,
} from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

const EMPTY_VALUE = 'Chưa cung cấp'
const HTTP_URL_PATTERN = /^https?:\/\//i

function ProfileItem({ icon: Icon, label, children, className }) {
  return (
    <div className={cn('rounded-xl bg-secondary/60 p-4', className)}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon aria-hidden="true" className="size-3.5" />}
        {label}
      </p>
      <div className="mt-1.5 text-sm font-medium break-words">{children ?? EMPTY_VALUE}</div>
    </div>
  )
}

function SafeImage({ src, alt, className, fallback }) {
  const [failedSrc, setFailedSrc] = useState(null)

  if (!src || failedSrc === src) {
    return fallback
  }

  return <img alt={alt} className={className} onError={() => setFailedSrc(src)} src={src} />
}

// Read-only presentation of the V02 Company profile fields (draft or review snapshot).
function CompanyProfileCard({ profile, badge }) {
  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="relative h-40 bg-hero sm:h-48">
        <SafeImage alt="" className="size-full object-cover" fallback={null} src={profile.bannerUrl} />
        {badge && <div className="absolute top-3 right-3">{badge}</div>}
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 bg-gradient-to-t from-hero/95 to-transparent p-4 sm:p-5">
          <SafeImage
            alt={`Logo ${profile.name ?? ''}`}
            className="size-16 shrink-0 rounded-lg border-2 border-card bg-card object-contain"
            fallback={
              <span className="flex size-16 shrink-0 items-center justify-center rounded-lg border-2 border-card bg-card text-primary">
                <Building2 aria-hidden="true" className="size-6" />
              </span>
            }
            src={profile.logoUrl}
          />
          <div className="min-w-0 text-hero-foreground">
            <p className="text-xs font-semibold uppercase tracking-wide text-hero-muted">
              Tổ chức kinh doanh
            </p>
            <p className="truncate text-xl font-bold">{profile.name ?? EMPTY_VALUE}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        <ProfileItem icon={FileBadge} label="Mã số doanh nghiệp">
          {profile.businessRegistrationNumber}
        </ProfileItem>
        <ProfileItem icon={Globe} label="Website">
          {profile.website && !HTTP_URL_PATTERN.test(profile.website) && profile.website}
          {profile.website && HTTP_URL_PATTERN.test(profile.website) && (
            <a
              className="inline-flex items-center gap-1 text-primary hover:underline"
              href={profile.website}
              rel="noreferrer"
              target="_blank"
            >
              {profile.website}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          )}
        </ProfileItem>
        <ProfileItem className="sm:col-span-2" icon={MapPin} label="Địa chỉ">
          {profile.address}
        </ProfileItem>
        <ProfileItem icon={Phone} label="Thông tin liên hệ">
          {profile.contactInfo}
        </ProfileItem>
        <ProfileItem icon={ImageIcon} label="Logo URL">
          {profile.logoUrl}
        </ProfileItem>
        <ProfileItem className="sm:col-span-2" label="Mô tả doanh nghiệp">
          {profile.description && (
            <p className="font-normal whitespace-pre-line text-muted-foreground">
              {profile.description}
            </p>
          )}
        </ProfileItem>
        <ProfileItem className="sm:col-span-2" icon={ImageIcon} label="Ảnh bìa doanh nghiệp">
          {profile.bannerUrl}
        </ProfileItem>
      </div>
    </article>
  )
}

export default CompanyProfileCard
