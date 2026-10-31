import { MapPin, Network, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'

import useDistrictLevelUnits from '../hooks/useDistrictLevelUnits'
import useFieldPositions from '../hooks/useFieldPositions'
import HierarchyPicker from './HierarchyPicker'

function usePositionOptions(fieldId) {
  const { positions, loading, error, reload } = useFieldPositions(fieldId)
  return { items: positions, loading, error, reload }
}

function useDistrictOptions(provinceCode) {
  const { units, loading, error, reload } = useDistrictLevelUnits(provinceCode)
  const items = useMemo(() => units.map((unit) => ({ id: unit.code, name: unit.name })), [units])
  return { items, loading, error, reload }
}

const CATEGORY_TEXT = Object.freeze({
  parentSearch: 'Nhập ngành nghề',
  childSearch: 'Nhập vị trí',
  chooseParent: 'Chọn một ngành nghề để xem vị trí.',
  unknownParent: 'Ngành nghề đã chọn',
})

const LOCATION_TEXT = Object.freeze({
  parentSearch: 'Nhập Tỉnh/Thành phố',
  childSearch: 'Nhập Quận/Huyện',
  chooseParent: 'Chọn một tỉnh/thành phố để xem quận/huyện.',
  unknownParent: 'Địa điểm đã chọn',
})

function JobSearchToolbar({
  keyword,
  categories,
  locations,
  fields,
  fieldsLoading,
  provinces,
  onSearch,
}) {
  const [keywordDraft, setKeywordDraft] = useState(keyword)
  const [syncedKeyword, setSyncedKeyword] = useState(keyword)
  const provinceOptions = useMemo(
    () => provinces.map((province) => ({ id: province.code, name: province.name })),
    [provinces],
  )

  if (syncedKeyword !== keyword) {
    setSyncedKeyword(keyword)
    setKeywordDraft(keyword)
  }

  return (
    <form
      aria-label="Tìm kiếm việc làm"
      className="grid gap-2 rounded-2xl border bg-card p-2 shadow-sm md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,12rem)_auto] lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,15rem)_auto] md:items-center"
      onSubmit={(event) => {
        event.preventDefault()
        onSearch({ keyword: keywordDraft.trim() })
      }}
      role="search"
    >
      <HierarchyPicker
        allLabel="Tất cả ngành nghề"
        icon={Network}
        label="Danh mục nghề"
        onApply={(selection) => onSearch({ categories: selection, keyword: keywordDraft.trim() })}
        parents={fields}
        parentsLoading={fieldsLoading}
        text={CATEGORY_TEXT}
        useChildren={usePositionOptions}
        value={categories}
      />

      <label className="flex h-12 min-w-0 items-center gap-3 rounded-xl border bg-secondary/40 px-3 focus-within:border-ring focus-within:bg-card">
        <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-muted-foreground">Vị trí tuyển dụng</span>
          <input
            className="w-full min-w-0 bg-transparent text-sm font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground"
            maxLength={200}
            onChange={(event) => setKeywordDraft(event.target.value)}
            placeholder="Tên việc làm, công ty, kỹ năng..."
            type="search"
            value={keywordDraft}
          />
        </span>
      </label>

      <HierarchyPicker
        align="end"
        allLabel="Tất cả địa điểm"
        icon={MapPin}
        label="Địa điểm"
        onApply={(selection) => onSearch({ locations: selection, keyword: keywordDraft.trim() })}
        parents={provinceOptions}
        parentsLoading={provinces.length === 0}
        text={LOCATION_TEXT}
        useChildren={useDistrictOptions}
        value={locations}
      />

      <Button className="h-12 rounded-xl px-6" type="submit">
        <Search aria-hidden="true" className="size-4" />
        Tìm kiếm
      </Button>
    </form>
  )
}

export default JobSearchToolbar
