import { useState } from 'react'

import { cn } from '@/lib/utils'

import { getCompanyInitials } from '../utils'

function CompanyLogo({ company, className }) {
  const [failedUrl, setFailedUrl] = useState(null)
  const showImage = company?.logoUrl && failedUrl !== company.logoUrl

  return (
    <span
      className={cn(
        'flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-primary/5 text-sm font-bold text-primary',
        className,
      )}
    >
      {showImage ? (
        <img
          alt={`Logo ${company.name}`}
          className="size-full object-contain p-1"
          onError={() => setFailedUrl(company.logoUrl)}
          src={company.logoUrl}
        />
      ) : (
        <span aria-hidden="true">{getCompanyInitials(company?.name)}</span>
      )}
    </span>
  )
}

export default CompanyLogo
