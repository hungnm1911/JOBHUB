import { useEffect, useMemo, useState } from 'react'

import { listFieldCategoriesApi } from '@/apis/category.api'
import { listProvincesApi } from '@/apis/location.api'

function useDiscoveryCatalogs() {
  const [fieldsView, setFieldsView] = useState({ loaded: false, fields: [], error: null })
  const [provinces, setProvinces] = useState([])

  useEffect(() => {
    let active = true

    listFieldCategoriesApi().then(
      ({ fields }) => {
        if (active) {
          setFieldsView({ loaded: true, fields, error: null })
        }
      },
      (error) => {
        if (active) {
          setFieldsView({ loaded: true, fields: [], error })
        }
      },
    )
    // Province names only enrich labels and the location filter; the page
    // stays usable with "all locations" when the catalog is unavailable.
    listProvincesApi().then(
      ({ provinces: items }) => {
        if (active) {
          setProvinces(items)
        }
      },
      () => {},
    )

    return () => {
      active = false
    }
  }, [])

  const provinceNameByCode = useMemo(
    () => new Map(provinces.map((province) => [province.code, province.name])),
    [provinces],
  )

  return {
    fields: fieldsView.fields,
    fieldsLoading: !fieldsView.loaded,
    fieldsError: fieldsView.error,
    provinces,
    provinceNameByCode,
  }
}

export default useDiscoveryCatalogs
