'use client'

import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, MessageSquare, Phone, Star } from 'lucide-react'
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { getNotificationDate } from '@/lib/notifications'
import { Button } from '@/components/ui/button'

type NotificationBellProps = {
  scope: 'company' | 'client'
}

type NotificationItem = {
  id: string
  title: string
  body: string
  type: 'chat' | 'call' | 'rating' | 'system'
  actionUrl?: string
  readAt?: any
  createdAt?: any
}

function formatRelativeDate(value: any) {
  const date = getNotificationDate(value)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000))

  if (diffMinutes < 60) return `${diffMinutes} min`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} h`
  return date.toLocaleDateString('pt-BR')
}

export function NotificationBell({ scope }: NotificationBellProps) {
  const router = useRouter()
  const { user, company } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const targetField = scope === 'company' ? 'recipientCompanyId' : 'recipientUserId'
    const targetValue = scope === 'company' ? company?.id : user?.uid

    if (!targetValue) {
      setNotifications([])
      return
    }

    const notificationQuery = query(collection(db, 'notifications'), where(targetField, '==', targetValue))
    const unsubscribe = onSnapshot(notificationQuery, (snapshot) => {
      const rows = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() } as NotificationItem))
        .sort((a, b) => getNotificationDate(b.createdAt).getTime() - getNotificationDate(a.createdAt).getTime())
        .slice(0, 16)

      setNotifications(rows)
    })

    return () => unsubscribe()
  }, [company?.id, scope, user?.uid])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleOutsideClick)
    }

    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  const unreadCount = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications])

  const markItemsAsRead = async (ids: string[]) => {
    if (ids.length === 0) return
    const batch = writeBatch(db)
    ids.forEach((id) => {
      batch.update(doc(db, 'notifications', id), { readAt: serverTimestamp() })
    })
    await batch.commit()
  }

  const markAllAsRead = async () => {
    await markItemsAsRead(notifications.filter((item) => !item.readAt).map((item) => item.id))
  }

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.readAt) {
      await updateDoc(doc(db, 'notifications', item.id), { readAt: serverTimestamp() })
    }
    setOpen(false)
    const actionUrl = item.actionUrl
    if (actionUrl) {
      startTransition(() => {
        router.push(actionUrl)
      })
    }
  }

  const getIcon = (type: NotificationItem['type']) => {
    if (type === 'chat') return <MessageSquare className="h-4 w-4 text-primary" />
    if (type === 'call') return <Phone className="h-4 w-4 text-primary" />
    if (type === 'rating') return <Star className="h-4 w-4 text-primary" />
    return <Bell className="h-4 w-4 text-primary" />
  }

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 lg:h-10 lg:w-10"
        onClick={() => setOpen((value) => !value)}
        data-testid={`${scope}-notification-trigger`}
      >
        <Bell className="h-4 w-4 lg:h-5 lg:w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground" data-testid={`${scope}-notification-count`}>
            {unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+12px)] z-[90] w-[360px] overflow-hidden rounded-[1.75rem] border border-border bg-background/95 shadow-[0_24px_80px_-32px_rgba(2,6,23,0.75)] backdrop-blur-2xl" data-testid={`${scope}-notification-panel`}>
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-semibold">Notificações</p>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Tempo real</span>
          </div>
          <div className="border-t border-border/70" />
          <div className="flex items-center justify-between px-4 py-2.5">
            <p className="text-xs text-muted-foreground">{unreadCount} não lidas</p>
            <Button variant="ghost" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0} data-testid={`${scope}-notification-read-all-button`}>
              <CheckCheck className="mr-2 h-4 w-4" />
              Ler tudo
            </Button>
          </div>
          <div className="border-t border-border/70" />
          <div className="max-h-[420px] overflow-y-auto p-2">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground" data-testid={`${scope}-notification-empty-state`}>
                Nenhuma notificação no momento.
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  className="flex w-full cursor-pointer items-start gap-3 rounded-2xl p-3 text-left transition hover:bg-secondary/60"
                  onClick={() => handleItemClick(item)}
                  data-testid={`${scope}-notification-item-${item.id}`}
                >
                  <div className="mt-1">{getIcon(item.type)}</div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                      <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{formatRelativeDate(item.createdAt)}</span>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                    {!item.readAt ? <span className="inline-block h-2 w-2 rounded-full bg-primary" data-testid={`${scope}-notification-unread-${item.id}`} /> : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}