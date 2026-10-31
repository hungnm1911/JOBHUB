import {
  ArrowLeft,
  Globe,
  Loader2,
  MapPin,
  Phone,
  RotateCw,
  SearchX,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import { API_ERROR_MESSAGE } from '@/utils/constant'

import useDiscoveryCompany from '../hooks/useDiscoveryCompany'
import { toJobDiscoveryErrorMessage } from '../utils'
import CompanyLogo from './CompanyLogo'

function toExternalUrl(website) {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`
}

function CompanyBanner({ bannerUrl }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="relative h-40 overflow-hidden bg-hero sm:h-56">
      {bannerUrl && !failed ? (
        <img
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
          src={bannerUrl}
        />
      ) : (
        <div
          aria-hidden="true"
          className="size-full bg-[radial-gradient(circle_at_80%_20%,var(--color-primary)_0%,transparent_55%)] opacity-60"
        />
      )}
    </div>
  )
}

function CompanyFact({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium break-words whitespace-pre-line">{children}</dd>
      </div>
    </div>
  )
}

function CompanyProfile({ companyId }) {
  const { company, loading, error, reload } = useDiscoveryCompany(companyId)
  const navigate = useNavigate()
  const location = useLocation()
  const canGoBack = location.key !== 'default'

  const backLink = (
    <Button
      className="w-fit px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
      onClick={() => (canGoBack ? navigate(-1) : navigate('/'))}
      type="button"
      variant="ghost"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {canGoBack ? 'Quay lại' : 'Về trang chủ'}
    </Button>
  )

  if (loading) {
    return (
      <CenteredState
        icon={Loader2}
        spinning
        title="Đang tải thông tin công ty"
        tone="bg-primary/10 text-primary"
      />
    )
  }

  if (error) {
    const notFound = error.status === 404 || error.status === 400 || error.status === 403

    return (
      <CenteredState
        action={
          notFound ? (
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft aria-hidden="true" className="size-4" />
                Về trang chủ
              </Link>
            </Button>
          ) : (
            <Button onClick={reload} variant="outline">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          )
        }
        description={toJobDiscoveryErrorMessage(error, API_ERROR_MESSAGE.COMPANY_NOT_FOUND)}
        icon={notFound ? SearchX : TriangleAlert}
        title={notFound ? 'Không xem được công ty' : 'Chưa tải được thông tin công ty'}
        tone="bg-secondary text-muted-foreground"
      />
    )
  }

  const hasFacts = company.website || company.address || company.contactInfo

  return (
    <article className="flex flex-col gap-6">
      {backLink}

      <header className="overflow-hidden rounded-2xl border bg-card">
        <CompanyBanner bannerUrl={company.bannerUrl} />
        <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end sm:px-8">
          <CompanyLogo
            className="relative -mt-10 size-20 border-4 border-card bg-card text-lg shadow-sm"
            company={company}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Nhà tuyển dụng</p>
            <h1 className="text-balance text-2xl font-bold tracking-tight break-words sm:text-3xl">
              {company.name}
            </h1>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section
          aria-labelledby="company-description-heading"
          className="rounded-2xl border bg-card p-6 sm:p-8"
        >
          <h2 className="text-lg font-semibold" id="company-description-heading">
            Giới thiệu công ty
          </h2>
          <p className="mt-3 max-w-[70ch] whitespace-pre-line text-base leading-7 text-foreground/90">
            {company.description || 'Công ty chưa cập nhật phần giới thiệu.'}
          </p>
        </section>

        <aside
          aria-labelledby="company-contact-heading"
          className="h-fit rounded-2xl border bg-card p-6"
        >
          <h2 className="text-base font-semibold" id="company-contact-heading">
            Thông tin liên hệ
          </h2>
          {hasFacts ? (
            <dl className="mt-4 space-y-4">
              {company.website && (
                <CompanyFact icon={Globe} label="Website">
                  <a
                    className="break-all text-primary underline-offset-4 hover:underline"
                    href={toExternalUrl(company.website)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {company.website}
                  </a>
                </CompanyFact>
              )}
              {company.address && (
                <CompanyFact icon={MapPin} label="Địa chỉ">
                  {company.address}
                </CompanyFact>
              )}
              {company.contactInfo && (
                <CompanyFact icon={Phone} label="Liên hệ">
                  {company.contactInfo}
                </CompanyFact>
              )}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Công ty chưa cập nhật thông tin liên hệ.</p>
          )}
        </aside>
      </div>
    </article>
  )
}

export default CompanyProfile
