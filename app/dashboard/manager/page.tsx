'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

export default function ManagerDashboardPage() {
  const { company } = useAuth()
  const [employees, setEmployees] = useState<any[]>([])
  const [chats, setChats] = useState<any[]>([])
  const [calls, setCalls] = useState<any[]>([])
  const [loaded, setLoaded] = useState({ employees: false, chats: false, calls: false })

  useEffect(() => {
    if (!company?.id) return
    const unsubs = [
      onSnapshot(query(collection(db, 'employees'), where('companyId', '==', company.id)), (snapshot) => {
        setEmployees(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
        setLoaded((current) => ({ ...current, employees: true }))
      }),
      onSnapshot(query(collection(db, 'chats'), where('companyId', '==', company.id)), (snapshot) => {
        setChats(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
        setLoaded((current) => ({ ...current, chats: true }))
      }),
      onSnapshot(query(collection(db, 'calls'), where('companyId', '==', company.id)), (snapshot) => {
        setCalls(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
        setLoaded((current) => ({ ...current, calls: true }))
      }),
    ]

    return () => unsubs.forEach((unsubscribe) => unsubscribe())
  }, [company?.id])

  const summary = useMemo(() => ({
    waitingChats: chats.filter((item) => item.status === 'waiting').length,
    activeCalls: calls.filter((item) => item.status === 'active').length,
    managers: employees.filter((item) => item.role === 'manager').length,
    attendants: employees.filter((item) => item.role === 'attendant' || item.role === 'employee').length,
  }), [calls, chats, employees])

  if (!loaded.employees || !loaded.chats || !loaded.calls) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6" data-testid="manager-dashboard-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Painel do gerente</h1>
          <p className="mt-2 text-sm text-muted-foreground">Acompanhe fila, ligações, equipe e prioridades operacionais em tempo real.</p>
        </div>
        <Button asChild data-testid="manager-dashboard-settings-link"><Link href="/dashboard/settings">Abrir configurações</Link></Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Chats aguardando', summary.waitingChats],
          ['Ligações ativas', summary.activeCalls],
          ['Gerentes', summary.managers],
          ['Atendentes', summary.attendants],
        ].map(([label, value]) => (
          <Card key={String(label)} className="glass border-border/80"><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></CardContent></Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="glass border-border/80">
          <CardHeader><CardTitle>Fila que exige atenção</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {chats.filter((item) => item.status === 'waiting').slice(0, 8).map((chat) => (
              <Link key={chat.id} href={`/dashboard/chats?chat=${chat.id}`} data-testid={`manager-waiting-chat-${chat.id}`}>
                <div className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-4 transition hover:border-primary/60">
                  <div>
                    <p className="font-semibold">{chat.clientName || 'Cliente'}</p>
                    <p className="text-sm text-muted-foreground">{chat.protocolo}</p>
                  </div>
                  <Badge variant="outline">aguardando</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="glass border-border/80">
          <CardHeader><CardTitle>Equipe</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {employees.slice(0, 8).map((employee) => (
              <div key={employee.id} className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-4">
                <div>
                  <p className="font-semibold">{employee.name || employee.fullName || employee.email}</p>
                  <p className="text-sm text-muted-foreground">{employee.email}</p>
                </div>
                <Badge variant="outline">{employee.role}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}