import { Search } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import LocationHierarchyPicker from './LocationHierarchyPicker'

function JobSearchBar({ keyword, locations, provinces, onSearch, onLocationChange }) {
  const [locationOpen, setLocationOpen] = useState(false)
  const { handleSubmit, register } = useForm({
    values: { keyword },
  })

  return (
    <form
      aria-label="Tìm kiếm việc làm"
      className={cn(
        'flex flex-col gap-2 rounded-2xl border bg-card p-2 shadow-sm md:flex-row md:items-center',
        locationOpen && 'mb-[52rem] sm:mb-[27rem] lg:mb-0',
      )}
      onSubmit={handleSubmit((values) => onSearch(values.keyword.trim()))}
      role="search"
    >
      <label className="flex min-h-12 flex-1 items-center gap-3 rounded-xl px-3 focus-within:bg-secondary/60">
        <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        <span className="sr-only">Từ khóa</span>
        <input
          className="h-12 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          maxLength={200}
          placeholder="Vị trí tuyển dụng, tên công ty, kỹ năng..."
          type="search"
          {...register('keyword')}
        />
      </label>

      <span aria-hidden="true" className="hidden h-8 w-px bg-border md:block" />

      <div className="min-w-0 md:w-80">
        <LocationHierarchyPicker
          locations={locations}
          onApply={onLocationChange}
          onOpenChange={setLocationOpen}
          panelClassName="max-md:top-[calc(100%+4rem)] md:max-lg:-right-40 lg:w-[min(30rem,calc(100vw-3rem))] xl:w-[min(38rem,calc(100vw-3rem))]"
          provinces={provinces}
        />
      </div>

      <Button className="h-12 rounded-xl px-7 text-base" type="submit">
        <Search aria-hidden="true" className="size-4" />
        Tìm kiếm
      </Button>
    </form>
  )
}

export default JobSearchBar
