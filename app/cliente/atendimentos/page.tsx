'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, MessageSquare, Phone, Search } from 'lucide-react'

function toDate(value: any) {
  if (!value) return new Date(0)
  if (typeof value?.toDate === 'function') return value.toDate()
  return new Date(value)
}

export default function ClientAttendancesPage() {
  const { user } = useAuth()
  const [chats, setChats] = useState<any[]>([])
  const [calls, setCalls] = useState<any[]>([])
  const [loaded, setLoaded] = useState({ chats: false, calls: false })
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!user?.uid) return
    const chatsQuery = query(collection(db, 'chats'), where('clientId', '==', user.uid))
    const callsQuery = query(collection(db, 'calls'), where('clientId', '==', user.uid))

    const unsubChats = onSnapshot(chatsQuery, (snapshot) => {
      setChats(
        snapshot.docs
          .map((item) => ({ id: item.id, ...(item.data() as any) }))
          .sort((a, b) => toDate(b.lastMessageAt || b.createdAt).getTime() - toDate(a.lastMessageAt || a.createdAt).getTime())
      )
      setLoaded((current) => ({ ...current, chats: true }))
    })

    const unsubCalls = onSnapshot(callsQuery, (snapshot) => {
      setCalls(
        snapshot.docs
          .map((item) => ({ id: item.id, ...(item.data() as any) }))
          .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())
      )
      setLoaded((current) => ({ ...current, calls: true }))
    })

    return () => {
      unsubChats()
      unsubCalls()
    }
  }, [user?.uid])

  const attendances = useMemo(() => {
    return [
      ...chats.map((chat) => ({
        id: `chat-${chat.id}`,
        kind: 'chat' as const,
        protocol: chat.protocolo || chat.id,
        companyName: chat.companyName || 'Empresa',
        status: chat.status || 'ativo',
        subtitle: chat.subject || chat.lastMessage || 'Atendimento por chat',
        href: `/cliente/chat/${chat.id}`,
        date: toDate(chat.lastMessageAt || chat.createdAt),
      })),
      ...calls.map((call) => ({
        id: `call-${call.id}`,
        kind: 'call' as const,
        protocol: call.protocolo || call.id,
        companyName: call.companyName || 'Empresa',
        status: call.status || 'waiting',
        subtitle: 'Ligação registrada',
        href: `/cliente/call/${call.id}`,
        date: toDate(call.createdAt),
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [calls, chats])

  const filteredAttendances = useMemo(() => {
    const text = search.trim().toLowerCase()
    if (!text) return attendances
    return attendances.filter((item) => `${item.protocol} ${item.companyName} ${item.status} ${item.subtitle}`.toLowerCase().includes(text))
  }, [attendances, search])

  if (!loaded.chats || !loaded.calls) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6" data-testid="client-attendances-page">
      <div>
        <h1 className="text-3xl font-bold">Meus atendimentos</h1>
        <p className="mt-2 text-sm text-muted-foreground">Chats e ligações reais vinculados à sua conta, separados por protocolo.</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar por protocolo, empresa ou status"
          className="h-12 pl-11"
          data-testid="client-attendances-search-input"
        />
      </div>

      <Card className="glass border-border/80">
        <CardHeader>
          <CardTitle>Histórico por protocolo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredAttendances.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum atendimento registrado.</div>
          ) : (
            filteredAttendances.map((item) => (
              <Link key={item.id} href={item.href} data-testid={`client-attendance-${item.id}`}>
                <div className="flex items-center justify-between gap-4 rounded-3xl border border-border bg-card/60 p-4 transition hover:border-primary/60">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      {item.kind === 'chat' ? <MessageSquare className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">Protocolo {item.protocol}</p>
                      <p className="truncate text-sm text-muted-foreground">{item.companyName} • {item.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="outline">{item.status}</Badge>
                    <span className="hidden text-xs text-muted-foreground sm:inline">{item.date.toLocaleDateString('pt-BR')}</span>
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
