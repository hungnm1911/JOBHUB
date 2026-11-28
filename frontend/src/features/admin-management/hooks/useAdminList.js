import {
  useListSearch,
  toListQuery,
  useDebouncedValue,
} from '@/features/recruiter-workspace/public'
import useAdminResource from './useAdminResource'
function useAdminList(spec, load, extra = {}) {
  const controls = useListSearch(spec)
  const q = useDebouncedValue(controls.search.q)
  const query = { ...toListQuery({ ...controls.search, q }), ...extra }
  const resource = useAdminResource(load, query)
  return { ...controls, resource }
}
export default useAdminList
