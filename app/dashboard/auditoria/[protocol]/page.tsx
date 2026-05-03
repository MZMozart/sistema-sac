'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, PlayCircle } from 'lucide-react'

function toDate(value: any) {
  if (!value) return new Date(0)
  if (typeof value?.toDate === 'function') return value.toDate()
  return new Date(value)
}

function formatSeconds(value: any) {
  const seconds = Math.max(0, Number(value || 0))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes <= 0) return `${rest}s`
  return `${minutes}min ${rest}s`
}

function cleanSummary(log: any) {
  const metadata = log.metadata || {}
  const eventType = String(log.eventType || '')
  const base = String(log.summary || 'Ação registrada.')

  if (eventType === 'call_muted') return `${log.clientName || log.employeeName || 'Participante'} silenciou o microfone.`
  if (eventType === 'call_unmuted') return `${log.clientName || log.employeeName || 'Participante'} reativou o microfone.`
  if (eventType === 'call_connection_drop') return 'A ligação teve uma oscilação de conexão.'
  if (eventType === 'call_reconnected') return 'O sistema tentou reconectar o áudio automaticamente.'
  if (eventType === 'call_message') return `${log.clientName || log.employeeName || 'Participante'} enviou mensagem no chat da ligação.`
  if (eventType === 'call_menu_selected') return `Cliente escolheu a opção ${metadata.digit || log.selectedOptionDigit || ''}${metadata.label ? ` (${metadata.label})` : ''}.`
  if (eventType === 'call_recording_saved') return 'Gravação da ligação salva.'
  if (eventType === 'call_recording_unavailable') return 'Gravação não ficou disponível nesse navegador.'
  if (eventType === 'call_ended') return `${base} Duração: ${formatSeconds(metadata.duration)}. Microfone silenciado por ${formatSeconds(metadata.muteDuration)}.`
  return base
}

export default function AuditoriaProtocolPage() {
  const params = useParams()
  const protocol = decodeURIComponent(String(params?.protocol || ''))
  const { company } = useAuth()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<any[]>([])
  const [chat, setChat] = useState<any>(null)
  const [call, setCall] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [callMessages, setCallMessages] = useState<any[]>([])
  const [ratings, setRatings] = useState<any[]>([])

  useEffect(() => {
    const loadProtocol = async () => {
      if (!company?.id || !protocol) return
      setLoading(true)
      const [logsSnap, chatsSnap, callsSnap, ratingsSnap] = await Promise.all([
        getDocs(query(collection(db, 'audit_logs'), where('companyId', '==', company.id), where('protocol', '==', protocol))),
        getDocs(query(collection(db, 'chats'), where('companyId', '==', company.id), where('protocolo', '==', protocol), limit(1))),
        getDocs(query(collection(db, 'calls'), where('companyId', '==', company.id), where('protocolo', '==', protocol), limit(1))),
        getDocs(query(collection(db, 'ratings'), where('companyId', '==', company.id), where('protocol', '==', protocol))),
      ])

      const chatRow = chatsSnap.empty ? null : { id: chatsSnap.docs[0].id, ...(chatsSnap.docs[0].data() as any) }
      const callRow = callsSnap.empty ? null : { id: callsSnap.docs[0].id, ...(callsSnap.docs[0].data() as any) }
      let messageRows: any[] = []
      let callMessageRows: any[] = []
      if (chatRow?.id) {
        const messagesSnap = await getDocs(query(collection(db, 'messages'), where('chatId', '==', chatRow.id)))
        messageRows = messagesSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })).sort((a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime())
      }
      if (callRow?.id) {
        const callMessagesSnap = await getDocs(query(collection(db, 'call_messages'), where('callId', '==', callRow.id)))
        callMessageRows = callMessagesSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })).sort((a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime())
      }

      setLogs(logsSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })).sort((a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime()))
      setChat(chatRow)
      setCall(callRow)
      setMessages(messageRows)
      setCallMessages(callMessageRows)
      setRatings(ratingsSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })))
      setLoading(false)
    }

    loadProtocol()
  }, [company?.id, protocol])

  const overview = useMemo(() => chat || call || null, [chat, call])
  const displayLogs = useMemo(() => {
    const seen = new Set<string>()
    return logs.filter((item) => {
      const date = toDate(item.createdAt)
      const key = `${item.eventType}|${cleanSummary(item)}|${Math.floor(date.getTime() / 3000)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [logs])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6" data-testid="audit-protocol-page">
      <div>
        <h1 className="text-3xl font-bold">Protocolo {protocol}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Visão completa das ações, mensagens, gravação e avaliação desse atendimento.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="glass border-border/80"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Canal</p><p className="mt-2 text-2xl font-bold">{chat ? 'Chat' : call ? 'Ligação' : 'Indefinido'}</p></CardContent></Card>
        <Card className="glass border-border/80"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Cliente</p><p className="mt-2 text-lg font-semibold">{overview?.clientName || 'Cliente'}</p></CardContent></Card>
        <Card className="glass border-border/80"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Atendente</p><p className="mt-2 text-lg font-semibold">{overview?.employeeName || 'Sem atendente'}</p></CardContent></Card>
        <Card className="glass border-border/80"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Status final</p><div className="mt-2"><Badge variant="outline">{overview?.status || 'sem status'}</Badge></div></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="glass border-border/80">
          <CardHeader><CardTitle>Timeline e ações</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {displayLogs.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">Nenhum evento auditado encontrado.</div> : displayLogs.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border bg-card/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{cleanSummary(item)}</p>
                    <p className="text-xs text-muted-foreground">Aconteceu às {toDate(item.createdAt).toLocaleTimeString('pt-BR')} em {toDate(item.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass border-border/80">
            <CardHeader><CardTitle>Dados do atendimento</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Data inicial: {toDate(overview?.createdAt).toLocaleString('pt-BR')}</p>
              <p>Resolvido: {overview?.botResolved ? 'Sim pelo BOT' : overview?.status === 'closed' || overview?.status === 'completed' ? 'Sim' : 'Não'}</p>
              <p>Encerrado por inatividade: {String(overview?.closedBy || '').includes('inactivity') ? 'Sim' : 'Não'}</p>
              <p>Transferido: {(overview?.transferCount || 0) > 0 ? 'Sim' : 'Não'}</p>
              <p>Posição de fila registrada: {overview?.queuePosition ?? 'não aplicável'}</p>
              <p>Quem ficou inativo: {overview?.inactiveActor || 'não identificado'}</p>
              <p>Tempo de inatividade registrado: {overview?.inactiveDurationSeconds ?? 0}s</p>
              <p>Opção numérica escolhida na ligação: {call?.selectedOptionDigit ? `${call.selectedOptionDigit} - ${call.selectedOptionLabel || 'sem rótulo'}` : 'não aplicável'}</p>
              <p>Mensagens paralelas na ligação: {call?.callChatMessageCount ?? callMessages.length}</p>
              <p>Arquivos trocados na ligação: {call?.callChatAttachmentCount ?? callMessages.filter((item) => item.fileUrl).length}</p>
              <p>Tempo total da ligação: {formatSeconds(call?.duration || overview?.duration || 0)}</p>
              <p>Tempo silenciado: {formatSeconds(call?.muteDuration || call?.muteDurationSeconds || 0)}</p>
              <p>Status da gravação: {call?.recordingUrl ? 'gravada e disponível' : call?.recordingStatus || 'pendente'}</p>
              {call?.recordingUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-foreground"><PlayCircle className="h-4 w-4 text-primary" /> Gravação da ligação</div>
                  <audio controls className="w-full" src={call.recordingUrl} data-testid="audit-protocol-recording" />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="glass border-border/80">
            <CardHeader><CardTitle>Avaliações</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {ratings.length === 0 ? <p className="text-sm text-muted-foreground">Sem avaliação registrada.</p> : ratings.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-card/60 p-4">
                  <p className="font-medium">Nota {item.rating}/5</p>
                  <p className="mt-2 text-sm text-muted-foreground">{item.comment || 'Sem comentário'}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {messages.length > 0 ? (
        <Card className="glass border-border/80">
          <CardHeader><CardTitle>Transcrição do chat</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className="rounded-2xl border border-border bg-card/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{message.senderName || message.senderType}</p>
                  <p className="text-xs text-muted-foreground">{toDate(message.createdAt).toLocaleString('pt-BR')}</p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{message.content || message.message || ''}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {callMessages.length > 0 ? (
        <Card className="glass border-border/80">
          <CardHeader><CardTitle>Chat paralelo da ligação</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {callMessages.map((message) => (
              <div key={message.id} className="rounded-2xl border border-border bg-card/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{message.senderName || message.senderType}</p>
                  <p className="text-xs text-muted-foreground">{toDate(message.createdAt).toLocaleString('pt-BR')}</p>
                </div>
                {message.content ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{message.content}</p> : null}
                {message.fileUrl ? (
                  <a href={message.fileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center rounded-full border border-border px-3 py-2 text-xs text-primary" data-testid={`audit-protocol-call-message-file-${message.id}`}>
                    Abrir arquivo: {message.fileName || 'anexo'}
                  </a>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
