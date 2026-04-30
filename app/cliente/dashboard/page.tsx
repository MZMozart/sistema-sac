'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock3, Loader2, MessageSquare, Phone } from 'lucide-react'

function toDate(value: any) {
  if (!value) return new Date(0)
  if (typeof value?.toDate === 'function') return value.toDate()
  return new Date(value)
}

export default function ClienteDashboard() {
  const { user, userData } = useAuth()
  const [chats, setChats] = useState<any[]>([])
  const [calls, setCalls] = useState<any[]>([])
  const [loaded, setLoaded] = useState({ chats: false, calls: false })

  useEffect(() => {
    if (!user?.uid) return

    const chatsQuery = query(collection(db, 'chats'), where('clientId', '==', user.uid))
    const callsQuery = query(collection(db, 'calls'), where('clientId', '==', user.uid))

    const unsubChats = onSnapshot(chatsQuery, (snapshot) => {
      const rows = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as any) }))
        .sort((a, b) => toDate(b.lastMessageAt || b.createdAt).getTime() - toDate(a.lastMessageAt || a.createdAt).getTime())
      setChats(rows)
      setLoaded((current) => ({ ...current, chats: true }))
    })

    const unsubCalls = onSnapshot(callsQuery, (snapshot) => {
      const rows = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as any) }))
        .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())
      setCalls(rows)
      setLoaded((current) => ({ ...current, calls: true }))
    })

    return () => {
      unsubChats()
      unsubCalls()
    }
  }, [user?.uid])

  const stats = useMemo(
    () => ({
      open: chats.filter((chat) => chat.status !== 'closed').length,
      active: chats.filter((chat) => ['active', 'waiting', 'bot'].includes(chat.status)).length,
      resolved: chats.filter((chat) => chat.status === 'closed').length,
    }),
    [chats]
  )

  const recentActivity = useMemo(
    () => [
      ...chats.slice(0, 4).map((chat) => ({
        id: `chat-${chat.id}`,
        type: 'chat',
        title: chat.companyName || 'Empresa',
        subtitle: chat.lastMessage || 'Sem mensagens ainda',
        status: chat.status,
        href: `/cliente/chat/${chat.id}`,
        date: toDate(chat.lastMessageAt || chat.createdAt),
      })),
      ...calls.slice(0, 4).map((call) => ({
        id: `call-${call.id}`,
        type: 'call',
        title: call.companyName || 'Ligação',
        subtitle: `Protocolo ${call.protocolo || call.id}`,
        status: call.status,
        href: `/cliente/call/${call.id}`,
        date: toDate(call.createdAt),
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6),
    [calls, chats]
  )

  if (!loaded.chats || !loaded.calls) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6" data-testid="client-dashboard-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Olá, {userData?.fullName?.split(' ')[0] || userData?.name || 'cliente'}.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Aqui estão seus atendimentos e ligações reais em andamento.</p>
        </div>
        <Button asChild className="bg-gradient-primary" data-testid="client-dashboard-open-ticket-button">
          <Link href="/cliente/novo">Abrir novo atendimento</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Abertos', stats.open],
          ['Em atendimento', stats.active],
          ['Resolvidos', stats.resolved],
        ].map(([label, value]) => (
          <Card key={String(label)} className="glass border-border/80">
            <CardHeader>
              <CardTitle className="text-base">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold" data-testid={`client-dashboard-stat-${String(label).toLowerCase().replace(/\s+/g, '-')}`}>{value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass border-border/80">
        <CardHeader>
          <CardTitle>Atividade recente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentActivity.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Você ainda não possui atendimentos registrados.
            </div>
          ) : (
            recentActivity.map((item) => (
              <Link key={item.id} href={item.href} data-testid={`client-dashboard-activity-${item.id}`}>
                <div className="flex items-center justify-between gap-4 rounded-3xl border border-border bg-card/60 p-4 transition hover:border-primary/60">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      {item.type === 'chat' ? <MessageSquare className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.title}</p>
                      <p className="truncate text-sm text-muted-foreground">{item.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{item.status || 'ativo'}</Badge>
                    <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><Clock3 className="h-3.5 w-3.5" />{item.date.toLocaleDateString('pt-BR')}</div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}