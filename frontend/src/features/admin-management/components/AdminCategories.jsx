import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import {
  listFieldCategoriesApi,
  listPositionCategoriesApi,
} from '@/apis/category.api'
import {
  createAdminFieldApi,
  createAdminPositionApi,
} from '@/apis/platform-admin.api'
import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'
import { adminCategorySchema, zodResolver } from '@/validation'
import { ConfirmDialog } from '@/features/recruiter-workspace/public'
import useAdminResource from '../hooks/useAdminResource'
import { AdminState, AdminPager } from './AdminUi'
const loadPositions = ({ fieldId, ...query }) =>
  fieldId
    ? listPositionCategoriesApi(fieldId, query)
    : Promise.resolve({
        positions: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      })
function AdminCategories() {
  const [params, setParams] = useSearchParams()
  const fields = useAdminResource(listFieldCategoriesApi)
  const selected =
    fields.data?.fields.find((item) => item.id === params.get('fieldId')) ??
    fields.data?.fields[0]
  const page = Math.max(1, Number(params.get('page')) || 1)
  const positions = useAdminResource(loadPositions, {
    fieldId: selected?.id,
    page,
    limit: 20,
  })
  const [kind, setKind] = useState(null)
  const [notice, setNotice] = useState('')
  const submitting = useRef(false)
  const form = useForm({
    resolver: zodResolver(adminCategorySchema),
    defaultValues: { name: '' },
  })
  const save = () =>
    form.handleSubmit(async ({ name }) => {
      if (submitting.current) return
      submitting.current = true
      try {
        if (kind === 'field') {
          const result = await createAdminFieldApi({ name })
          fields.reload()
          setParams({ fieldId: result.category.id })
        } else {
          await createAdminPositionApi({ fieldId: selected.id, name })
          positions.reload()
        }
        setNotice(
          'Đã bổ sung danh mục. Danh mục sau khi tạo không thể sửa hoặc xóa.',
        )
        setKind(null)
        form.reset()
      } catch (error) {
        form.setError('name', { message: error.message }, { shouldFocus: true })
      } finally {
        submitting.current = false
      }
    })()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Danh mục nghề nghiệp"
        description="Cấu trúc hai cấp: lĩnh vực và vị trí. Chỉ bổ sung danh mục mới."
        actions={
          <Button
            onClick={() => {
              form.reset()
              setKind('field')
            }}
          >
            + Thêm lĩnh vực
          </Button>
        }
      />
      {notice && (
        <p className="rounded-lg border bg-secondary p-4 text-sm" role="status">
          {notice}
        </p>
      )}
      <AdminState resource={fields}>
        <section className="grid overflow-hidden rounded-xl border bg-card md:grid-cols-[240px_minmax(0,1fr)]">
          <nav
            aria-label="Lĩnh vực"
            className="flex flex-col gap-1 border-b bg-secondary/30 p-3 md:border-r md:border-b-0"
          >
            {fields.data?.fields.map((item) => (
              <button
                aria-current={selected?.id === item.id ? 'true' : undefined}
                className={`rounded-md px-3 py-3 text-left text-sm ${selected?.id === item.id ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-secondary'}`}
                key={item.id}
                onClick={() => setParams({ fieldId: item.id })}
              >
                {item.name}
              </button>
            ))}
            {!fields.data?.fields.length && (
              <p className="p-3 text-sm text-muted-foreground">
                Chưa có lĩnh vực.
              </p>
            )}
          </nav>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
              <h2 className="font-semibold">{selected?.name ?? 'Vị trí'}</h2>
              <Button
                disabled={!selected}
                onClick={() => {
                  form.reset()
                  setKind('position')
                }}
                size="sm"
              >
                + Thêm vị trí
              </Button>
            </div>
            <div className="p-5">
              <AdminState resource={positions}>
                <ul className="divide-y">
                  {positions.data?.positions.map((item) => (
                    <li className="py-4 text-sm" key={item.id}>
                      {item.name}
                    </li>
                  ))}
                </ul>
                {!positions.data?.positions.length && (
                  <p className="py-8 text-sm text-muted-foreground">
                    Chưa có vị trí.
                  </p>
                )}
                <AdminPager
                  pagination={positions.data?.pagination}
                  onPageChange={(next) =>
                    setParams({ fieldId: selected.id, page: next })
                  }
                />
              </AdminState>
            </div>
          </div>
        </section>
      </AdminState>
      <p className="text-sm text-muted-foreground">
        Danh mục được tạo là bất biến: không đổi tên, chuyển lĩnh vực hoặc xóa.
      </p>
      <ConfirmDialog
        open={!!kind}
        title={kind === 'field' ? 'Thêm lĩnh vực' : 'Thêm vị trí'}
        description="Tên danh mục cần duy nhất trong phạm vi tương ứng. Kiểm tra kỹ trước khi tạo."
        confirmLabel="Tạo danh mục"
        busy={form.formState.isSubmitting}
        onCancel={() => setKind(null)}
        onConfirm={save}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <label className="grid gap-2 text-sm">
            Tên danh mục
            <Input
              aria-invalid={!!form.formState.errors.name}
              autoFocus
              {...form.register('name')}
            />
          </label>
          {form.formState.errors.name && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {form.formState.errors.name.message}
            </p>
          )}
        </form>
      </ConfirmDialog>
    </div>
  )
}
export default AdminCategories
