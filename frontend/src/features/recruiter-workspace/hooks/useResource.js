import { useCallback, useEffect, useState } from 'react'

// `load` must be a stable module-level function; `params` must be JSON-serializable.
// A reload keeps the current data on screen; only new params show the loading state.
function useResource(load, params) {
  const key = JSON.stringify(params ?? null)
  const [version, setVersion] = useState(0)
  const [view, setView] = useState({ key: null, data: null, error: null })

  useEffect(() => {
    let active = true
    load(JSON.parse(key)).then(
      (data) => active && setView({ key, data, error: null }),
      (error) => active && setView({ key, data: null, error }),
    )
    return () => {
      active = false
    }
  }, [load, key, version])

  const reload = useCallback(() => setVersion((current) => current + 1), [])
  const current = view.key === key

  return {
    loading: !current,
    data: current ? view.data : null,
    error: current ? view.error : null,
    reload,
  }
}

export default useResource
