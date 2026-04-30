'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, PlayCircle } from 'lucide-react'

function toDate(value: any) {
  if (!value) return new Date(0)
  if (typeof value?.toDate === 'function') return value.toDate()
  return new Date(value)
}

export default function AuditoriaPage() {
  const { company } = useAuth()
  const [queryText, setQueryText] = useState('')
  const [logs, setLogs] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [calls, setCalls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (!company?.id) return
      setLoading(true)
      const [logsSnap, messagesSnap, callsSnap] = await Promise.all([
        getDocs(query(collection(db, 'audit_logs'), where('companyId', '==', company.id))),
        getDocs(query(collection(db, 'messages'), where('companyId', '==', company.id))),
        getDocs(query(collection(db, 'calls'), where('companyId', '==', company.id))),
      ])

      setLogs(logsSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })).sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime()))
      setMessages(messagesSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })).sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime()))
      setCalls(callsSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })).sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime()))
      setLoading(false)
    }

    loadData()
  }, [company?.id])

  const filteredLogs = useMemo(() => {
    const normalized = queryText.trim().toLowerCase()
    if (!normalized) return logs
    return logs.filter((item) =>
      [item.protocol, item.clientName, item.employeeName, item.summary]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    )
  }, [logs, queryText])

  return (
    <div className="space-y-6" data-testid="dashboard-auditoria-page">
      <div>
        <h1 className="text-3xl font-bold">Auditoria e histórico</h1>
        <p className="mt-2 text-sm text-muted-foreground">Busque por protocolo, cliente ou atendente e veja a timeline completa do atendimento.</p>
      </div>

      <Card className="glass border-border/80">
        <CardContent className="p-5">
          <Input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Buscar por protocolo, cliente ou atendente" data-testid="auditoria-search-input" />
        </CardContent>
      </Card>

      {loading ? <div className="flex items-center justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div> : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card className="glass border-border/80">
            <CardHeader><CardTitle>Timeline do atendimento</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {filteredLogs.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum log encontrado.</div> : filteredLogs.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-card/60 p-4" data-testid={`audit-log-${item.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.summary}</p>
                      <Link href={`/dashboard/auditoria/${encodeURIComponent(item.protocol || item.chatId || item.callId)}`} className="text-xs text-primary hover:underline" data-testid={`audit-protocol-link-${item.id}`}>{item.protocol || item.chatId || item.callId}</Link>
                    </div>
                    <Badge variant="outline">{item.eventType}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{toDate(item.createdAt).toLocaleString('pt-BR')}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="glass border-border/80">
              <CardHeader><CardTitle>Histórico completo do chat</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {messages.filter((item) => !queryText || String(item.chatId || '').includes(queryText) || String(item.senderName || '').toLowerCase().includes(queryText.toLowerCase())).slice(0, 20).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border bg-card/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{item.senderName || item.senderType}</span>
                      <span className="text-xs text-muted-foreground">{toDate(item.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{item.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="glass border-border/80">
              <CardHeader><CardTitle>Reprodução da ligação</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {calls.filter((item) => !queryText || String(item.protocolo || '').toLowerCase().includes(queryText.toLowerCase()) || String(item.clientName || '').toLowerCase().includes(queryText.toLowerCase()) || String(item.employeeName || '').toLowerCase().includes(queryText.toLowerCase())).slice(0, 10).map((call) => (
                  <div key={call.id} className="rounded-2xl border border-border bg-card/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Link href={`/dashboard/auditoria/${encodeURIComponent(call.protocolo || call.id)}`} className="font-medium text-primary hover:underline" data-testid={`audit-call-link-${call.id}`}>{call.protocolo || call.id}</Link>
                        <p className="text-xs text-muted-foreground">{call.clientName || 'Cliente'} • {call.employeeName || 'Sem atendente'}</p>
                      </div>
                      <Badge variant="outline">{call.status || 'completed'}</Badge>
                    </div>
                    {call.recordingUrl ? (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm"><PlayCircle className="h-4 w-4 text-primary" /> Reprodução da gravação</div>
                        <audio controls className="w-full" src={call.recordingUrl} data-testid={`call-recording-${call.id}`} />
                      </div>
                    ) : <p className="mt-3 text-sm text-muted-foreground">Sem gravação disponível.</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}