'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function AttendantDashboardPage() {
  const { company, user } = useAuth()
  const [myChats, setMyChats] = useState<any[]>([])
  const [myCalls, setMyCalls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company?.id || !user?.uid) return

    const unsubs = [
      onSnapshot(query(collection(db, 'chats'), where('companyId', '==', company.id), where('employeeId', '==', user.uid)), (snapshot) => {
        setMyChats(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
        setLoading(false)
      }),
      onSnapshot(query(collection(db, 'calls'), where('companyId', '==', company.id), where('employeeId', '==', user.uid)), (snapshot) => {
        setMyCalls(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
      }),
    ]

    return () => unsubs.forEach((unsubscribe) => unsubscribe())
  }, [company?.id, user?.uid])

  const summary = useMemo(() => ({
    openChats: myChats.filter((item) => item.status !== 'closed').length,
    activeCalls: myCalls.filter((item) => item.status === 'active').length,
    completedCalls: myCalls.filter((item) => item.status === 'completed').length,
  }), [myCalls, myChats])

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6" data-testid="attendant-dashboard-page">
      <div>
        <h1 className="text-3xl font-bold">Painel do atendente</h1>
        <p className="mt-2 text-sm text-muted-foreground">Acompanhe seus chats e ligações reais assumidos dentro da operação.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Chats em aberto', summary.openChats],
          ['Ligações ativas', summary.activeCalls],
          ['Ligações concluídas', summary.completedCalls],
        ].map(([label, value]) => (
          <Card key={String(label)} className="glass border-border/80"><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></CardContent></Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="glass border-border/80">
          <CardHeader><CardTitle>Seus chats</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {myChats.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum chat assumido ainda.</div> : myChats.map((chat) => (
              <Link key={chat.id} href={`/dashboard/chats?chat=${chat.id}`} data-testid={`attendant-chat-${chat.id}`}>
                <div className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-4 transition hover:border-primary/60">
                  <div>
                    <p className="font-semibold">{chat.clientName || 'Cliente'}</p>
                    <p className="text-sm text-muted-foreground">{chat.protocolo}</p>
                  </div>
                  <Badge variant="outline">{chat.status}</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="glass border-border/80">
          <CardHeader><CardTitle>Suas ligações</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {myCalls.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhuma ligação assumida ainda.</div> : myCalls.map((call) => (
              <Link key={call.id} href="/dashboard/telephony" data-testid={`attendant-call-${call.id}`}>
                <div className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-4 transition hover:border-primary/60">
                  <div>
                    <p className="font-semibold">{call.clientName || 'Cliente'}</p>
                    <p className="text-sm text-muted-foreground">{call.protocolo || call.id}</p>
                  </div>
                  <Badge variant="outline">{call.status}</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}