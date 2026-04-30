'use client'

import { startTransition, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, Bot, History, LayoutDashboard, MessageSquare, Phone, Settings, Star, Trophy, Users } from 'lucide-react'
import { getPortalContainer } from '@/lib/portal'
import { cn } from '@/lib/utils'

type SidebarProps = {
  userType: 'client' | 'company'
  expanded: boolean
  onOpen: () => void
  onClose: () => void
  role?: 'owner' | 'manager' | 'employee'
  permissions?: any
}

const clientMenu = [
  { label: 'Dashboard', href: '/cliente/dashboard', icon: LayoutDashboard },
  { label: 'Atendimentos', href: '/cliente/atendimentos', icon: MessageSquare },
  { label: 'Novo atendimento', href: '/cliente/novo', icon: MessageSquare },
  { label: 'Configurações', href: '/cliente/configuracoes', icon: Settings },
]

const companyMenu = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Chats', href: '/dashboard/chats', icon: MessageSquare },
  { label: 'Ligações', href: '/dashboard/telephony', icon: Phone },
  { label: 'Equipe', href: '/dashboard/employees', icon: Users },
  { label: 'BOT', href: '/dashboard/bot', icon: Bot },
  { label: 'Avaliações', href: '/dashboard/ratings', icon: Star },
  { label: 'Relatórios', href: '/dashboard/reports', icon: BarChart3 },
  { label: 'Ranking', href: '/dashboard/ranking', icon: Trophy },
  { label: 'Auditoria', href: '/dashboard/auditoria', icon: History },
  { label: 'Configurações', href: '/dashboard/settings', icon: Settings },
]

export function Sidebar({ userType, expanded, onOpen, onClose, role = 'owner', permissions }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const scopedCompanyMenu = companyMenu.map((item) => item.href === '/dashboard'
    ? { ...item, href: role === 'manager' ? '/dashboard/manager' : role === 'employee' ? '/dashboard/attendant' : '/dashboard' }
    : item)

  const menu = userType === 'company'
    ? scopedCompanyMenu.filter((item) => {
        if (role === 'owner') return true
        if (role === 'manager') {
          if (item.href === '/dashboard/employees') return permissions?.canManageEmployees ?? true
          if (item.href === '/dashboard/bot') return permissions?.canEditBotPolicies ?? true
          if (item.href === '/dashboard/reports') return permissions?.canExportData ?? true
          if (item.href === '/dashboard/ranking') return permissions?.canExportData ?? true
          if (item.href === '/dashboard/auditoria') return permissions?.canExportData ?? true
          if (item.href === '/dashboard/settings') return permissions?.canEditCompanySettings ?? true
          return true
        }

        if (item.href === '/dashboard/employees') return permissions?.canManageEmployees ?? false
        if (item.href === '/dashboard/bot') return permissions?.canEditBotPolicies ?? false
        if (item.href === '/dashboard/ratings') return permissions?.canViewRatings ?? false
        if (item.href === '/dashboard/reports') return permissions?.canExportData ?? false
        if (item.href === '/dashboard/ranking') return permissions?.canExportData ?? false
        if (item.href === '/dashboard/auditoria') return permissions?.canExportData ?? false
        if (item.href === '/dashboard/settings') return true
        return ['/dashboard', '/dashboard/chats', '/dashboard/telephony'].includes(item.href)
      })
    : clientMenu

  const handleItemClick = (href: string) => {
    if (!expanded) {
      onOpen()
      return
    }

    if (href === pathname) {
      onClose()
      return
    }

    onClose()
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <>
      {mounted && expanded ? createPortal(
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/20 backdrop-blur-[1px]"
          onClick={onClose}
          aria-label="Fechar menu lateral"
          data-testid={`${userType}-sidebar-overlay`}
        />,
        getPortalContainer() ?? document.body,
      ) : null}
      <aside
        className={cn(
          'fixed left-0 top-16 z-30 h-[calc(100vh-4rem)] overflow-hidden border-r border-border bg-card/90 backdrop-blur-xl transition-all duration-300',
          expanded ? 'w-72 translate-x-0 shadow-[0_24px_80px_-32px_rgba(2,6,23,0.6)]' : 'max-lg:-translate-x-full lg:w-20 lg:translate-x-0 lg:cursor-pointer'
        )}
        onClick={() => {
          if (!expanded) onOpen()
        }}
        data-testid={`${userType}-sidebar`}
      >
        <nav className="flex h-full flex-col gap-2 p-3">
          {menu.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon

            return (
              <button
                key={item.href}
                type="button"
                onClick={() => handleItemClick(item.href)}
                className={cn(
                  'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all',
                  active ? 'bg-primary text-primary-foreground shadow-[0_18px_40px_-24px_rgba(37,99,235,0.7)]' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  !expanded && 'justify-center px-0'
                )}
                data-testid={`${userType}-sidebar-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span
                  className={cn(
                    'truncate whitespace-nowrap transition-[max-width,opacity] duration-200',
                    expanded ? 'max-w-[140px] opacity-100' : 'max-w-0 opacity-0'
                  )}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </nav>
      </aside>
    </>
  )
}