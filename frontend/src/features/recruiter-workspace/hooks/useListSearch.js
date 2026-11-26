import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const TEXT_MAX_LENGTH = 200
const DEBOUNCE_MS = 300

// `spec` maps a field to its allowed values (array, first is the default), or to
// 'text' / 'id'. Filters live in the URL; changing one returns to page 1.
// Unrelated params (such as the active tab) are preserved. Pass a module-level spec.
function useListSearch(spec) {
  const [searchParams, setSearchParams] = useSearchParams()

  const search = useMemo(() => {
    const result = {}
    for (const [field, rule] of Object.entries(spec)) {
      const raw = searchParams.get(field) ?? ''
      if (rule === 'text') result[field] = raw.slice(0, TEXT_MAX_LENGTH)
      else if (rule === 'id') result[field] = /^[a-fA-F0-9]{24}$/.test(raw) ? raw : ''
      else result[field] = rule.includes(raw) ? raw : rule[0]
    }
    const page = searchParams.get('page') ?? ''
    result.page = /^[1-9]\d{0,5}$/.test(page) ? Number(page) : 1
    return result
  }, [searchParams, spec])

  const setFilters = useCallback(
    (patch) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.delete('page')
          for (const [field, value] of Object.entries(patch)) {
            const rule = spec[field]
            const isDefault = !value || (Array.isArray(rule) && value === rule[0])
            if (isDefault) next.delete(field)
            else next.set(field, value)
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams, spec],
  )

  const setPage = useCallback(
    (page) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        if (page > 1) next.set('page', String(page))
        else next.delete('page')
        return next
      })
    },
    [setSearchParams],
  )

  const reset = useCallback(() => {
    setFilters(Object.fromEntries(Object.keys(spec).map((field) => [field, ''])))
  }, [setFilters, spec])

  return { search, setFilters, setPage, reset }
}

function useDebouncedValue(value) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [value])
  return debounced
}

// The query the backend accepts: blank values are omitted, never sent empty.
function toListQuery(search, limit = 20) {
  const query = { limit }
  for (const [field, value] of Object.entries(search)) {
    const text = typeof value === 'string' ? value.trim() : value
    if (text) query[field] = text
  }
  return query
}

export { toListQuery, useDebouncedValue }
export default useListSearch
