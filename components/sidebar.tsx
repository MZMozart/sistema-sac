'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  MessageSquare,
  Phone,
  Inbox,
  Users,
  Shield,
  Cloud,
  Bot,
  Settings,
  FileText,
  BarChart2,
  Folder,
} from 'lucide-react'

export function Sidebar() {
  const pathname = usePathname()

  const items = [
    { label: 'Dashboard', href: '/dashboard', icon: Home },
    { label: 'Atendimentos', href: '/dashboard/chats', icon: MessageSquare },
    { label: 'Chamadas', href: '/dashboard/calls', icon: Phone },
    { label: 'Tickets', href: '/dashboard/tickets', icon: Inbox },
    { label: 'Clientes', href: '/dashboard/clients', icon: Users },
    { label: 'Equipe', href: '/dashboard/employees', icon: Users },
    { label: 'Permissões', href: '/dashboard/permissions', icon: Shield },
    { label: 'Automação', href: '/dashboard/automation', icon: Cloud },
    { label: 'Chatbot', href: '/dashboard/chatbot', icon: Bot },
    { label: 'Telefonia', href: '/dashboard/telephony', icon: Phone },
    { label: 'URA', href: '/dashboard/ura', icon: Folder },
    { label: 'Filas', href: '/dashboard/queues', icon: FileText },
    { label: 'Relatórios', href: '/dashboard/reports', icon: BarChart2 },
    { label: 'Configurações', href: '/dashboard/settings', icon: Settings },
  ]

  return (
    <aside className="w-64 lg:w-64 md:w-20 bg-card border-r border-border h-full fixed top-0 left-0 pt-20 overflow-auto z-30">
      <nav className="flex flex-col">
        {items.map((item) => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-3 hover:bg-secondary transition-colors ${
                active ? 'bg-secondary text-foreground font-semibold' : 'text-muted-foreground'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="hidden md:inline truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
