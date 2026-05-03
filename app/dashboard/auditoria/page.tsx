'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, PlayCircle } from 'lucide-react'

const PAGE_SIZE = 10

function toDate(value: any) {
  if (!value) return new Date(0)
  if (typeof value?.toDate === 'function') return value.toDate()
  return new Date(value)
}

export default function AuditoriaPage() {
  const { company } = useAuth()
  const [queryText, setQueryText] = useState('')
  const [chatPage, setChatPage] = useState(1)
  const [callPage, setCallPage] = useState(1)
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

  useEffect(() => {
    setChatPage(1)
    setCallPage(1)
  }, [queryText])

  const protocolCases = useMemo(() => {
    const rows = new Map<string, any>()
    const ensureCase = (key: string, base: any = {}) => {
      if (!rows.has(key)) {
        rows.set(key, {
          id: key,
          protocol: key,
          chatId: base.chatId || null,
          callId: base.callId || null,
          clientName: base.clientName || null,
          employeeName: base.employeeName || null,
          summary: base.summary || 'Atendimento registrado no sistema.',
          latestAt: toDate(base.createdAt),
          logs: [],
          messages: [],
          calls: [],
        })
      }
      return rows.get(key)
    }

    logs.forEach((log) => {
      const key = String(log.protocol || log.chatId || log.callId || log.id)
      const item = ensureCase(key, log)
      item.logs.push(log)
      item.chatId = item.chatId || log.chatId || null
      item.callId = item.callId || log.callId || null
      item.clientName = item.clientName || log.clientName || null
      item.employeeName = item.employeeName || log.employeeName || null
      const date = toDate(log.createdAt)
      if (date > item.latestAt) {
        item.latestAt = date
        item.summary = log.summary || item.summary
      }
    })

    calls.forEach((call) => {
      const key = String(call.protocolo || call.protocol || call.id)
      const item = ensureCase(key, call)
      item.calls.push(call)
      item.callId = item.callId || call.id
      item.clientName = item.clientName || call.clientName || null
      item.employeeName = item.employeeName || call.employeeName || null
      const date = toDate(call.createdAt)
      if (date > item.latestAt) item.latestAt = date
    })

    messages.forEach((message) => {
      const linkedLog = logs.find((log) => log.chatId && log.chatId === message.chatId)
      const key = String(linkedLog?.protocol || message.chatId || message.id)
      const item = ensureCase(key, { chatId: message.chatId, createdAt: message.createdAt })
      item.messages.push(message)
      item.chatId = item.chatId || message.chatId || null
      const date = toDate(message.createdAt)
      if (date > item.latestAt) item.latestAt = date
    })

    return Array.from(rows.values()).sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime())
  }, [calls, logs, messages])

  const filteredCases = useMemo(() => {
    const normalized = queryText.trim().toLowerCase()
    if (!normalized) return protocolCases
    return protocolCases.filter((item) =>
      [item.protocol, item.clientName, item.employeeName, item.summary, item.chatId, item.callId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    )
  }, [protocolCases, queryText])

  const chatCases = useMemo(() => {
    return filteredCases.filter((item) => item.chatId || item.messages.length > 0 || item.logs.some((log: any) => log.channel === 'chat'))
  }, [filteredCases])

  const callCases = useMemo(() => {
    return filteredCases.filter((item) => item.callId || item.calls.length > 0 || item.logs.some((log: any) => log.channel === 'call'))
  }, [filteredCases])

  const chatTotalPages = Math.max(1, Math.ceil(chatCases.length / PAGE_SIZE))
  const callTotalPages = Math.max(1, Math.ceil(callCases.length / PAGE_SIZE))
  const currentChatPage = Math.min(chatPage, chatTotalPages)
  const currentCallPage = Math.min(callPage, callTotalPages)
  const pagedChatCases = chatCases.slice((currentChatPage - 1) * PAGE_SIZE, currentChatPage * PAGE_SIZE)
  const pagedCallCases = callCases.slice((currentCallPage - 1) * PAGE_SIZE, currentCallPage * PAGE_SIZE)

  const renderPagination = (page: number, totalPages: number, onPageChange: (page: number) => void) => {
    if (totalPages <= 1) return null

    return (
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>
          Anterior
        </Button>
        <span className="text-xs text-muted-foreground">
          Pagina {page} de {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}>
          Proxima
        </Button>
      </div>
    )
  }

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
            <CardHeader><CardTitle>Chats por protocolo</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {chatCases.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum chat encontrado.</div> : pagedChatCases.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-card/60 p-4" data-testid={`audit-protocol-card-${item.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.summary}</p>
                      <Link href={`/dashboard/auditoria/${encodeURIComponent(item.protocol)}`} className="text-xs text-primary hover:underline" data-testid={`audit-protocol-link-${item.id}`}>{item.protocol}</Link>
                    </div>
                    <Badge variant="outline">{item.logs.length + item.messages.length} eventos</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.clientName || 'Cliente'} • {item.employeeName || 'Sem atendente'} • {item.latestAt.toLocaleString('pt-BR')}
                  </p>
                </div>
              ))}
              {renderPagination(currentChatPage, chatTotalPages, setChatPage)}
            </CardContent>
          </Card>

          <Card className="glass border-border/80">
            <CardHeader><CardTitle>Ligações por protocolo</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {callCases.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhuma ligação encontrada.</div> : pagedCallCases.map((item) => {
                const call = item.calls[0] || {}
                return (
                  <div key={item.id} className="rounded-2xl border border-border bg-card/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Link href={`/dashboard/auditoria/${encodeURIComponent(item.protocol)}`} className="font-medium text-primary hover:underline" data-testid={`audit-call-link-${item.id}`}>{item.protocol}</Link>
                        <p className="text-xs text-muted-foreground">{item.clientName || call.clientName || 'Cliente'} • {item.employeeName || call.employeeName || 'Sem atendente'}</p>
                      </div>
                      <Badge variant="outline">{call.status || 'registrada'}</Badge>
                    </div>
                    {call.recordingUrl ? (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm"><PlayCircle className="h-4 w-4 text-primary" /> Reprodução da gravação</div>
                        <audio controls className="w-full" src={call.recordingUrl} data-testid={`call-recording-${item.id}`} />
                      </div>
                    ) : <p className="mt-3 text-sm text-muted-foreground">Sem gravação disponível.</p>}
                  </div>
                )
              })}
              {renderPagination(currentCallPage, callTotalPages, setCallPage)}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
