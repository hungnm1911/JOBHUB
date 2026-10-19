import { LoaderCircle, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useAppSelector } from '@/store/hooks'
import { FLASH_MESSAGE_TYPE } from '@/utils/constant'

import { logout } from '../services/authentication.service'
import { selectAuthenticatedUser } from '../slice'

function getInitials(fullName) {
  return (fullName ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function SessionAccountCard({ roleLabel, logoutMessage }) {
  const user = useAppSelector(selectAuthenticatedUser)
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)

    try {
      await logout()
    } catch (error) {
      toast.error(error.message)
    }

    navigate('/login', {
      replace: true,
      state: {
        registeredEmail: user?.email,
        flash: {
          type: FLASH_MESSAGE_TYPE.INFO,
          title: 'Đã đăng xuất',
          message: logoutMessage,
        },
      },
    })
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-hero text-sm font-semibold text-hero-foreground">
        {getInitials(user?.fullName)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{roleLabel}</span>
        <span className="block truncate text-sm font-semibold">{user?.email}</span>
      </span>
      <Button
        aria-label="Đăng xuất"
        disabled={loggingOut}
        onClick={handleLogout}
        size="icon"
        title="Đăng xuất"
        type="button"
        variant="ghost"
      >
        {loggingOut ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <LogOut aria-hidden="true" className="size-4" />
        )}
      </Button>
    </div>
  )
}

export default SessionAccountCard
