import { ChevronDown, MapPin, Search } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'

function JobSearchBar({ keyword, provinceCode, provinces, onSearch }) {
  const { handleSubmit, register, setValue } = useForm({
    values: { keyword, provinceCode },
  })

  // A native select drops a value whose option is not rendered yet, so the
  // URL province is re-applied once the province catalog arrives.
  useEffect(() => {
    if (provinces.length > 0) {
      setValue('provinceCode', provinceCode)
    }
  }, [provinces, provinceCode, setValue])

  return (
    <form
      aria-label="Tìm kiếm việc làm"
      className="flex flex-col gap-2 rounded-2xl border bg-card p-2 shadow-sm md:flex-row md:items-center"
      onSubmit={handleSubmit((values) =>
        onSearch({ keyword: values.keyword.trim(), provinceCode: values.provinceCode }),
      )}
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

      <label className="relative flex min-h-12 items-center gap-3 rounded-xl px-3 focus-within:bg-secondary/60 md:w-80">
        <MapPin aria-hidden="true" className="size-5 shrink-0 text-primary" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-muted-foreground">Địa điểm</span>
          <select
            className="w-full min-w-0 appearance-none truncate bg-transparent pr-6 text-sm font-medium outline-none"
            {...register('provinceCode')}
          >
            <option value="">Tất cả địa điểm</option>
            {provinces.map((province) => (
              <option key={province.code} value={province.code}>
                {province.name}
              </option>
            ))}
          </select>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 size-4 text-muted-foreground"
        />
      </label>

      <Button className="h-12 rounded-xl px-7 text-base" type="submit">
        <Search aria-hidden="true" className="size-4" />
        Tìm kiếm
      </Button>
    </form>
  )
}

export default JobSearchBar
