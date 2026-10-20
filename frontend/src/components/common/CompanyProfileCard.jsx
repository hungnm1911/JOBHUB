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

function ProfileDetail({ label, children, className, valueClassName }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-sm leading-5 text-muted-foreground">{label}</dt>
      <dd className={cn('mt-1.5 min-w-0 text-[0.9375rem] leading-6 whitespace-pre-line [overflow-wrap:anywhere]', valueClassName)}>
        {children || EMPTY_VALUE}
      </dd>
    </div>
  )
}

// Read-only presentation of the V02 Company profile fields (draft or review snapshot).
// The review presentation is opt-in; snapshot consumers retain the default layout.
function CompanyProfileCard({ profile, badge, presentation = 'default' }) {
  if (presentation === 'review') {
    return (
      <article className="min-w-0 p-5 sm:p-6 md:p-10">
        <header className="flex flex-col items-start gap-4 border-b pb-6 sm:flex-row sm:gap-5 sm:pb-8">
          <SafeImage
            alt={`Logo ${profile.name ?? ''}`}
            className="size-12 shrink-0 rounded-md border bg-card object-contain sm:size-16"
            fallback={
              <span
                aria-label="Không có logo có thể hiển thị"
                className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground sm:size-16"
                role="img"
              >
                <Building2 aria-hidden="true" className="size-6" />
              </span>
            }
            src={profile.logoUrl}
          />
          <div className="min-w-0">
            <h2 className="max-w-2xl text-[1.625rem] leading-[2.125rem] font-semibold tracking-[-0.03em] text-balance [overflow-wrap:anywhere] sm:text-[1.75rem] sm:leading-9 md:text-[2rem] md:leading-10">
              {profile.name || EMPTY_VALUE}
            </h2>
            <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.8125rem] leading-5 text-muted-foreground">
              <p>Hồ sơ doanh nghiệp</p>
              {badge && <><span aria-hidden="true">·</span>{badge}</>}
            </div>
          </div>
        </header>

        <section className="mt-6 grid min-w-0 gap-3.5 sm:gap-4 md:mt-7 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-6">
          <h3 className="text-base leading-6 font-semibold tracking-[-0.01em]">Thông tin pháp lý</h3>
          <dl>
            <ProfileDetail label="Mã số doanh nghiệp" valueClassName="text-base font-medium tabular-nums">
              {profile.businessRegistrationNumber}
            </ProfileDetail>
          </dl>
        </section>

        <section className="mt-6 grid min-w-0 gap-3.5 sm:gap-4 md:mt-7 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-6">
          <h3 className="text-base leading-6 font-semibold tracking-[-0.01em]">Liên hệ</h3>
          <dl className="grid min-w-0 gap-x-8 gap-y-5 sm:grid-cols-2">
            <ProfileDetail className="sm:col-span-2" label="Website">
              {profile.website && (
                HTTP_URL_PATTERN.test(profile.website) ? (
                  <a
                    className="rounded-sm underline decoration-muted-foreground underline-offset-4 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                    href={profile.website}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {profile.website}
                  </a>
                ) : profile.website
              )}
            </ProfileDetail>
            <ProfileDetail label="Địa chỉ">{profile.address}</ProfileDetail>
            <ProfileDetail label="Thông tin liên hệ">{profile.contactInfo}</ProfileDetail>
          </dl>
        </section>

        <section className="mt-7 grid min-w-0 gap-3.5 border-t pt-7 sm:gap-4 md:mt-8 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-6 md:pt-8">
          <h3 className="text-base leading-6 font-semibold tracking-[-0.01em]">Giới thiệu doanh nghiệp</h3>
          <p className="max-w-[65ch] text-base leading-7 whitespace-pre-line text-pretty [overflow-wrap:anywhere]">
            {profile.description || EMPTY_VALUE}
          </p>
        </section>

        <section className="mt-7 grid min-w-0 gap-3.5 border-t pt-7 sm:gap-4 md:mt-8 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-6 md:pt-8">
          <h3 className="text-base leading-6 font-semibold tracking-[-0.01em]">Hình ảnh thương hiệu</h3>
          <dl className="grid min-w-0 gap-4">
            <div className="min-w-0">
              <dt className="text-sm leading-5 text-muted-foreground">Ảnh bìa doanh nghiệp</dt>
              <dd className="mt-3 flex w-fit min-w-0 max-w-full items-center justify-center rounded-md border bg-background p-3">
                <SafeImage
                  alt={`Ảnh bìa ${profile.name ?? ''}`}
                  className="block h-auto max-h-60 w-auto max-w-full object-contain"
                  fallback={
                    <p className="p-3 text-sm leading-6 text-muted-foreground">
                      Không có ảnh bìa có thể hiển thị.
                    </p>
                  }
                  src={profile.bannerUrl}
                />
              </dd>
            </div>
            <ProfileDetail label="Logo URL" valueClassName="text-sm leading-5 text-muted-foreground">
              {profile.logoUrl}
            </ProfileDetail>
            <ProfileDetail label="Ảnh bìa URL" valueClassName="text-sm leading-5 text-muted-foreground">
              {profile.bannerUrl}
            </ProfileDetail>
          </dl>
        </section>
      </article>
    )
  }

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
