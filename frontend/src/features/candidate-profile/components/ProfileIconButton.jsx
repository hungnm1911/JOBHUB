import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function ProfileIconButton({ label, tone = 'default', className, children, ...props }) {
  return (
    <Button
      aria-label={label}
      className={cn('size-9 shrink-0', className)}
      size="icon"
      title={label}
      type="button"
      variant="ghost"
      {...props}
    >
      <span className={cn(tone === 'danger' && 'text-destructive')}>{children}</span>
    </Button>
  )
}

export default ProfileIconButton
