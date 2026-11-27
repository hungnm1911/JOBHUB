import { CircleX, LoaderCircle, RotateCw } from 'lucide-react'

import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'

function RouteAccessState({ title, description, loading = false, retry = false }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <CenteredState
        action={
          retry && (
            <Button onClick={() => window.location.reload()} variant="outline">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          )
        }
        description={description}
        icon={loading ? LoaderCircle : CircleX}
        spinning={loading}
        title={title}
        tone={loading ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}
      />
    </div>
  )
}

export default RouteAccessState
