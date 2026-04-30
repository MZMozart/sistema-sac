'use client'

import { startTransition, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Logo } from '@/components/logo'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut, Menu, Settings, UserCircle2 } from 'lucide-react'

type HeaderProps = {
  scope: 'client' | 'company'
  profileHref: string
  settingsHref: string
}

export function Header({ scope, profileHref, settingsHref }: HeaderProps) {
  const router = useRouter()
  const { userData, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [menuOpen])

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth/login')
  }

  const handleMenuNavigation = (href: string) => {
    setMenuOpen(false)
    startTransition(() => {
      router.push(href)
    })
  }

  const name = userData?.fullName || userData?.name || userData?.email || 'Usuário'
  const initials = name.charAt(0).toUpperCase()

  const toggleSidebar = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-sidebar-toggle'))
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-border bg-background/92 backdrop-blur-xl">
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar} data-testid={`${scope}-header-sidebar-toggle`}>
            <Menu className="h-5 w-5" />
          </Button>
          <Link href={scope === 'client' ? '/cliente/dashboard' : '/dashboard'} className="flex items-center gap-3" data-testid={`${scope}-header-logo-link`}>
          <Logo size="sm" />
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:gap-3" ref={containerRef}>
          <ThemeToggle />
          <NotificationBell scope={scope} />

          <Button
            variant="ghost"
            className="relative h-10 w-10 rounded-full p-0"
            onClick={() => setMenuOpen((value) => !value)}
            data-testid={`${scope}-header-menu-trigger`}
          >
            <Avatar className="h-10 w-10 border border-primary/20">
              <AvatarImage src={userData?.photoURL} />
              <AvatarFallback className="bg-gradient-primary text-white">{initials}</AvatarFallback>
            </Avatar>
          </Button>

          {menuOpen ? (
            <div className="absolute right-4 top-[calc(100%+8px)] z-[80] w-64 overflow-hidden rounded-[1.4rem] border border-border bg-background/95 shadow-[0_24px_80px_-28px_rgba(2,6,23,0.5)] backdrop-blur-xl" data-testid={`${scope}-header-menu-panel`}>
              <div className="border-b border-border px-4 py-4">
                <p className="truncate font-medium">{name}</p>
                <p className="truncate text-sm text-muted-foreground">{userData?.email}</p>
              </div>
              <div className="p-2">
                <button type="button" className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition hover:bg-secondary" onClick={() => handleMenuNavigation(profileHref)} data-testid={`${scope}-header-profile-link`}>
                  <UserCircle2 className="h-4 w-4" />
                  Perfil
                </button>
                <button type="button" className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition hover:bg-secondary" onClick={() => handleMenuNavigation(settingsHref)} data-testid={`${scope}-header-settings-link`}>
                  <Settings className="h-4 w-4" />
                  Configurações
                </button>
                <button type="button" className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm text-destructive transition hover:bg-destructive/10" onClick={handleSignOut} data-testid={`${scope}-header-logout-button`}>
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}