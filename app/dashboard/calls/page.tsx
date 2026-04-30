'use client'

import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Phone, PhoneCall } from 'lucide-react'

function toDate(value: any) {
  if (!value) return new Date()
  if (typeof value?.toDate === 'function') return value.toDate()
  return new Date(value)
}

export default function CallsPage() {
  const { company } = useAuth()
  const [calls, setCalls] = useState<any[]>([])

  useEffect(() => {
    if (!company?.id) return
    const callsQuery = query(collection(db, 'calls'), where('companyId', '==', company.id))
    const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
      const rows = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() } as any))
        .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())
      setCalls(rows)
    })
    return () => unsubscribe()
  }, [company?.id])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Histórico de ligações</h1>
        <p className="mt-2 text-sm text-muted-foreground">Todas as chamadas reais registradas pela empresa aparecem aqui.</p>
      </div>

      <Card className="glass border-border/80">
        <CardHeader>
          <CardTitle>Registro operacional</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[720px] pr-3">
            <div className="space-y-3">
              {calls.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhuma ligação registrada ainda.</div>
              ) : calls.map((call) => (
                <div key={call.id} className="rounded-3xl border border-border bg-card/60 p-4" data-testid={`calls-log-${call.id}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <PhoneCall className="h-4 w-4 text-primary" />
                        <p className="font-semibold">{call.protocolo || call.id}</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">Cliente: {call.clientName || 'Não informado'}</p>
                      <p className="text-sm text-muted-foreground">Atendente: {call.employeeName || 'Ainda sem atendente'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{call.status || 'waiting'}</Badge>
                      <Badge className="bg-primary/10 text-primary"><Phone className="mr-1 h-3 w-3" />{call.duration || 0}s</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}