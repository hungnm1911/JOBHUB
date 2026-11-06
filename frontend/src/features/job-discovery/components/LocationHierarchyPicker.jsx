import { MapPin } from 'lucide-react'
import { useMemo } from 'react'

import useDistrictLevelUnits from '../hooks/useDistrictLevelUnits'
import HierarchyPicker from './HierarchyPicker'

const LOCATION_TEXT = Object.freeze({
  parentSearch: 'Nhập Tỉnh/Thành phố',
  childSearch: 'Nhập Quận/Huyện',
  chooseParent: 'Chọn một tỉnh/thành phố để xem quận/huyện.',
  unknownParent: 'Địa điểm đã chọn',
})

function useDistrictOptions(provinceCode) {
  const { units, loading, error, reload } = useDistrictLevelUnits(provinceCode)
  const items = useMemo(() => units.map((unit) => ({ id: unit.code, name: unit.name })), [units])
  return { items, loading, error, reload }
}

function LocationHierarchyPicker({ locations, provinces, onApply, onOpenChange, panelClassName }) {
  const provinceOptions = useMemo(
    () => provinces.map((province) => ({ id: province.code, name: province.name })),
    [provinces],
  )

  return (
    <HierarchyPicker
      align="end"
      allLabel="Tất cả địa điểm"
      icon={MapPin}
      label="Địa điểm"
      onApply={onApply}
      onOpenChange={onOpenChange}
      panelClassName={panelClassName}
      parents={provinceOptions}
      parentsLoading={provinces.length === 0}
      text={LOCATION_TEXT}
      useChildren={useDistrictOptions}
      value={locations}
    />
  )
}

export default LocationHierarchyPicker
