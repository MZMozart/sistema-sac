'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, doc, increment, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createNotification } from '@/lib/notifications'
import { createAuditLog } from '@/lib/audit'
import { rebalanceCallQueue } from '@/lib/call-queue'
import { useAuth } from '@/contexts/auth-context'
import { LiveCallRoom } from '@/components/calls/live-call-room'
import { CallRealtimeChat } from '@/components/calls/call-realtime-chat'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ArrowRight, FileText, Headphones, Loader2, MessageSquare, PhoneCall, UserRoundX, Volume2 } from 'lucide-react'

type CallSession = {
  id: string
  callId: string
  protocolo: string
  companyId: string
  companyName: string
  clientId: string
  clientName?: string
  clientEmail?: string
  employeeId?: string
  employeeName?: string
  queuePosition?: number | null
  selectedOptionLabel?: string
  selectedOptionDescription?: string
  status: 'waiting' | 'ringing' | 'active' | 'ended' | 'completed'
  createdAt?: any
  recordingUrl?: string | null
  transferCount?: number
  muteDurationSeconds?: number
}

type AttendantRecord = {
  id: string
  userId: string
  name?: string
  email?: string
  role?: string
  isActive?: boolean
}

function toDate(value: any) {
  if (!value) return new Date()
  if (typeof value?.toDate === 'function') return value.toDate()
  return new Date(value)
}

export default function TelephonyPage() {
  const { company, user, userData } = useAuth()
  const [sessions, setSessions] = useState<CallSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [loading, setLoading] = useState(true)
  const [attendants, setAttendants] = useState<AttendantRecord[]>([])
  const [search, setSearch] = useState('')
  const [activePanel, setActivePanel] = useState<'details' | 'chat' | 'transfer'>('details')

  useEffect(() => {
    if (!company?.id) return
    const callsQuery = query(collection(db, 'call_sessions'), where('companyId', '==', company.id))
    const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
      const rows = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as any) } as CallSession))
        .sort((a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime())
      setSessions(rows)
      setLoading(false)
      if (selectedSessionId && !rows.some((row) => row.id === selectedSessionId)) {
        setSelectedSessionId(null)
      }
    })

    return () => unsubscribe()
  }, [company?.id, selectedSessionId])

  useEffect(() => {
    if (!company?.id) return
    const employeeQuery = query(collection(db, 'employees'), where('companyId', '==', company.id))
    const unsubscribe = onSnapshot(employeeQuery, (snapshot) => {
      const rows = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as any) } as AttendantRecord))
        .filter((employee) => employee.isActive !== false && ['employee', 'attendant', 'manager', 'owner'].includes(employee.role || 'employee'))
      setAttendants(rows)
    })

    return () => unsubscribe()
  }, [company?.id])

  useEffect(() => {
    return () => {
      localStream?.getTracks().forEach((track) => track.stop())
    }
  }, [localStream])

  const waitingSessions = useMemo(
    () => sessions.filter((session) => ['waiting', 'ringing'].includes(session.status)).sort((a, b) => Number(a.queuePosition || 9999) - Number(b.queuePosition || 9999)),
    [sessions]
  )

  const filteredSessions = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return waitingSessions
    return waitingSessions.filter((session) => [session.protocolo, session.clientName, session.clientEmail, session.selectedOptionLabel].filter(Boolean).some((value) => String(value).toLowerCase().includes(term)))
  }, [search, waitingSessions])

  const activeSession = sessions.find((session) => session.id === selectedSessionId) || null
  const nextWaitingSession = filteredSessions[0] || waitingSessions[0] || null

  const attendantsWithLoad = attendants
    .map((attendant) => ({
      ...attendant,
      activeCount: sessions.filter((session) => session.employeeId === attendant.userId && ['active', 'ringing', 'waiting'].includes(session.status)).length,
    }))
    .sort((a, b) => a.activeCount - b.activeCount)

  const enableAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(company?.settings?.audioSettings?.inputDeviceId && company.settings.audioSettings.inputDeviceId !== 'default'
            ? { deviceId: { exact: company.settings.audioSettings.inputDeviceId } }
            : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      setLocalStream(stream)
      setAudioEnabled(true)
    } catch {
      alert('Permita o uso do microfone para entrar na ligação pelo navegador.')
    }
  }

  const assumeCall = async (session: CallSession) => {
    if (!user) return
    await updateDoc(doc(db, 'call_sessions', session.id), {
      employeeId: user.uid,
      employeeName: userData?.fullName || user.displayName || 'Atendente',
      status: 'ringing',
      queuePosition: null,
    })
    await updateDoc(doc(db, 'calls', session.callId || session.id), {
      employeeId: user.uid,
      employeeName: userData?.fullName || user.displayName || 'Atendente',
      status: 'ringing',
      queuePosition: null,
    })

    if (!session.employeeId && company?.id) {
      await updateDoc(doc(db, 'employees', `${company.id}_${user.uid}`), {
        totalCalls: increment(1),
      })
    }

    await createNotification({
      recipientCompanyId: session.companyId,
      recipientUserId: session.clientId,
      title: 'Ligação sendo conectada',
      body: `${userData?.fullName || user.displayName || 'Atendente'} assumiu sua ligação ${session.protocolo}.`,
      type: 'call',
      actionUrl: `/cliente/call/${session.id}`,
      entityId: session.id,
      entityType: 'call',
      actorName: userData?.fullName || user.displayName || 'Atendente',
    })

    await createAuditLog({
      companyId: session.companyId,
      companyName: session.companyName,
      protocol: session.protocolo,
      callId: session.callId || session.id,
      channel: 'call',
      eventType: 'call_answered',
      employeeId: user.uid,
      employeeName: userData?.fullName || user.displayName || 'Atendente',
      clientId: session.clientId,
      clientName: session.clientName || null,
      summary: 'Ligação assumida por um atendente.',
    })

    await rebalanceCallQueue(session.companyId)
    setSelectedSessionId(session.id)
    setAudioEnabled(false)
  }

  const handleAttendQueue = async () => {
    if (nextWaitingSession) {
      await assumeCall(nextWaitingSession)
    }
  }

  const handleNextClient = async () => {
    if (activeSession) {
      setSelectedSessionId(null)
      setAudioEnabled(false)
    }
    const nextSession = waitingSessions.find((session) => session.id !== activeSession?.id)
    if (nextSession) {
      await assumeCall(nextSession)
    }
  }

  const requestTransfer = async (target: AttendantRecord) => {
    if (!activeSession || !user) return
    await updateDoc(doc(db, 'call_sessions', activeSession.id), {
      transferRequestedToUserId: target.userId,
      transferRequestedToName: target.name || target.email || 'Atendente',
      transferRequestedByUserId: user.uid,
      transferRequestedByName: userData?.fullName || user.displayName || 'Atendente',
      transferRequestedAt: serverTimestamp(),
      transferCount: increment(1),
    })
    await updateDoc(doc(db, 'calls', activeSession.callId || activeSession.id), {
      transferRequestedToUserId: target.userId,
      transferRequestedToName: target.name || target.email || 'Atendente',
      transferRequestedByUserId: user.uid,
      transferRequestedByName: userData?.fullName || user.displayName || 'Atendente',
      transferRequestedAt: serverTimestamp(),
      transferCount: increment(1),
    })
    await createNotification({
      recipientCompanyId: activeSession.companyId,
      recipientUserId: target.userId,
      title: 'Solicitação de apoio na ligação',
      body: `${userData?.fullName || user.displayName || 'Atendente'} pediu apoio para o protocolo ${activeSession.protocolo}.`,
      type: 'call',
      actionUrl: '/dashboard/telephony',
      entityId: activeSession.callId || activeSession.id,
      entityType: 'call',
      actorName: userData?.fullName || user.displayName || 'Atendente',
    })
    await createAuditLog({
      companyId: activeSession.companyId,
      companyName: activeSession.companyName,
      protocol: activeSession.protocolo,
      callId: activeSession.callId || activeSession.id,
      channel: 'call',
      eventType: 'call_transfer_requested',
      clientId: activeSession.clientId,
      clientName: activeSession.clientName || null,
      employeeId: target.userId,
      employeeName: target.name || target.email || null,
      summary: 'Atendente abriu uma solicitação de transferência/apoio da ligação.',
      metadata: {
        requestedBy: userData?.fullName || user.displayName || 'Atendente',
      },
    })
    setActivePanel('transfer')
  }

  const transferTargets = attendantsWithLoad.filter((attendant) => attendant.userId !== user?.uid)

  useEffect(() => {
    if (!activeSession?.id) return
    setActivePanel('details')
  }, [activeSession?.id])

  if (activeSession) {
    return (
      <div className="fixed inset-x-0 bottom-0 top-16 z-20 overflow-hidden bg-background lg:left-24" data-testid="telephony-active-call-shell">
        <div className="grid h-full min-h-0 gap-0 lg:grid-cols-[1fr_360px]">
          <div className="flex min-h-0 flex-col overflow-hidden border-b border-border lg:border-b-0 lg:border-r">
            <div className="shrink-0 border-b border-border px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Ligação em andamento</p>
                  <h2 className="text-xl font-bold">{activeSession.clientName || 'Cliente'}</h2>
                  <p className="text-xs text-muted-foreground">{activeSession.protocolo} • Motivo: {activeSession.selectedOptionLabel || 'Não informado'}</p>
                </div>
                <Badge variant="outline">{activeSession.status}</Badge>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden p-4">
              {audioEnabled ? (
                <LiveCallRoom
                  roomId={activeSession.id}
                  callId={activeSession.callId || activeSession.id}
                  protocol={activeSession.protocolo}
                  companyId={activeSession.companyId}
                  companyName={activeSession.companyName || company?.nomeFantasia || company?.razaoSocial || 'Empresa'}
                  currentUserId={user?.uid || ''}
                  currentUserName={userData?.fullName || user?.displayName || 'Atendente'}
                  mode="agent"
                  clientUserId={activeSession.clientId}
                  agentUserId={user?.uid || ''}
                  audioSettings={company?.settings?.audioSettings}
                  initialLocalStream={localStream}
                  immersive
                />
              ) : (
                <Card className="glass h-full border-border/80">
                  <CardContent className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <p className="text-lg font-semibold">Ativar áudio da ligação</p>
                      <p className="mt-2 text-sm text-muted-foreground">Clique para entrar com microfone e escutar o cliente em tempo real.</p>
                      <Button className="mt-4" onClick={enableAudio} data-testid="telephony-enable-audio-button">Ativar áudio agora</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="shrink-0 border-t border-border px-4 py-3">
              <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2 rounded-full border border-border bg-card/90 px-3 py-2 shadow-lg lg:gap-3">
                <Button variant="outline" onClick={handleNextClient} data-testid="telephony-next-client-button"><ArrowRight className="mr-2 h-4 w-4" />Próximo cliente</Button>
                <Button variant={activePanel === 'transfer' ? 'default' : 'outline'} onClick={() => setActivePanel('transfer')} data-testid="telephony-transfer-client-button"><UserRoundX className="mr-2 h-4 w-4" />Transferir cliente</Button>
                <Button variant={activePanel === 'details' ? 'default' : 'outline'} onClick={() => setActivePanel('details')} data-testid="telephony-details-button"><FileText className="mr-2 h-4 w-4" />Detalhes da ligação</Button>
                <Button variant={activePanel === 'chat' ? 'default' : 'outline'} onClick={() => setActivePanel('chat')} data-testid="telephony-send-message-button"><MessageSquare className="mr-2 h-4 w-4" />Enviar mensagem</Button>
                <Button variant="outline" onClick={enableAudio} data-testid="telephony-hear-remote-button"><Volume2 className="mr-2 h-4 w-4" />Ouvir ligação</Button>
              </div>
            </div>
          </div>

          <aside className="flex min-h-0 flex-col overflow-hidden border-t border-border bg-card/40 lg:border-l lg:border-t-0">
            {activePanel === 'chat' ? (
              <CallRealtimeChat
                roomId={activeSession.id}
                callId={activeSession.callId || activeSession.id}
                protocol={activeSession.protocolo}
                companyId={activeSession.companyId}
                companyName={activeSession.companyName}
                currentUserId={user?.uid || ''}
                currentUserName={userData?.fullName || user?.displayName || 'Atendente'}
                senderType="employee"
                clientId={activeSession.clientId}
                employeeId={user?.uid || ''}
              />
            ) : activePanel === 'transfer' ? (
              <>
                <div className="shrink-0 border-b border-border px-4 py-4">
                  <h3 className="font-semibold" data-testid="telephony-transfer-panel-title">Transferir / pedir apoio</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Selecione outro atendente para registrar a solicitação operacional da ligação.</p>
                </div>
                <ScrollArea className="min-h-0 flex-1 px-4 py-4" data-testid="telephony-transfer-panel-scroll-area">
                  <div className="space-y-3">
                    {transferTargets.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-testid="telephony-transfer-panel-empty-state">
                        Nenhum outro atendente disponível agora.
                      </div>
                    ) : transferTargets.map((attendant) => (
                      <div key={attendant.id} className="rounded-2xl border border-border bg-card/70 p-4" data-testid={`telephony-transfer-row-${attendant.userId}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">{attendant.name || attendant.email || 'Atendente'}</p>
                            <p className="text-xs text-muted-foreground">{attendant.email || 'Sem e-mail'} • {sessions.filter((session) => session.employeeId === attendant.userId && ['active', 'ringing', 'waiting'].includes(session.status)).length} atendimentos</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => requestTransfer(attendant)} data-testid={`telephony-transfer-confirm-${attendant.userId}`}>
                            Solicitar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <>
                <div className="shrink-0 border-b border-border px-4 py-4">
                  <h3 className="font-semibold" data-testid="telephony-details-panel-title">Detalhes da ligação</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Protocolo, cliente, horário, atendente e eventos do atendimento.</p>
                  <div className="mt-4 space-y-2 text-sm text-muted-foreground" data-testid="telephony-details-panel-metadata">
                    <p><strong className="text-foreground">Protocolo:</strong> {activeSession.protocolo}</p>
                    <p><strong className="text-foreground">Cliente:</strong> {activeSession.clientName || 'Cliente'}</p>
                    <p><strong className="text-foreground">E-mail:</strong> {activeSession.clientEmail || 'Sem email'}</p>
                    <p><strong className="text-foreground">Status:</strong> {activeSession.status}</p>
                    <p><strong className="text-foreground">Data e hora:</strong> {toDate(activeSession.createdAt).toLocaleString('pt-BR')}</p>
                    <p><strong className="text-foreground">Atendente:</strong> {activeSession.employeeName || 'Ainda não assumida'}</p>
                    <p><strong className="text-foreground">Ações registradas:</strong> Gravação: {activeSession.recordingUrl ? 'disponível' : 'pendente'} • Transferências: {activeSession.transferCount || 0} • Silêncio: {activeSession.muteDurationSeconds || 0}s</p>
                  </div>
                </div>

                <div className="shrink-0 border-b border-border px-4 py-4">
                  <p className="text-sm text-muted-foreground">Próximos clientes da fila</p>
                  <p className="mt-2 text-2xl font-bold" data-testid="telephony-waiting-count">{waitingSessions.length}</p>
                </div>

                <ScrollArea className="min-h-0 flex-1 px-4 py-4">
                  <div className="space-y-3">
                    {filteredSessions.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhum cliente aguardando na fila.</div>
                    ) : filteredSessions.map((session) => (
                      <div key={session.id} className="rounded-2xl border border-border bg-card/70 p-4" data-testid={`telephony-queue-row-${session.id}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{session.clientName || 'Cliente'}</p>
                            <p className="text-xs text-muted-foreground">{session.protocolo}</p>
                          </div>
                          <Badge variant="outline">Fila {session.queuePosition || '-'}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">Motivo: {session.selectedOptionLabel || session.selectedOptionDescription || 'Não informado'}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card className="glass border-border/80">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Ligações aguardando</p>
              <p className="mt-2 text-3xl font-bold">{waitingSessions.length}</p>
            </div>
            <div className="flex items-center gap-2 text-primary"><PhoneCall className="h-5 w-5" /> Tempo real</div>
          </CardContent>
        </Card>

        <Card className="glass border-border/80">
          <CardHeader>
            <CardTitle>Atender fila</CardTitle>
            <CardDescription>Atende automaticamente o primeiro cliente da fila por ordem de chegada.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-gradient-primary" disabled={!nextWaitingSession} onClick={handleAttendQueue} data-testid="telephony-attend-queue-button">
              <Headphones className="mr-2 h-4 w-4" />
              Atender fila
            </Button>
          </CardContent>
        </Card>

        <Card className="glass border-border/80 xl:col-span-2">
          <CardHeader>
            <CardTitle>Atendentes disponíveis</CardTitle>
            <CardDescription>Sugestão automática por menor fila ativa.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {attendantsWithLoad.slice(0, 4).map((attendant) => (
              <div key={attendant.id} className="rounded-2xl border border-border bg-card/60 p-4">
                <p className="font-medium">{attendant.name || attendant.email}</p>
                <p className="mt-2 text-sm text-muted-foreground">{attendant.activeCount} ligações/chats ativos</p>
                <Badge className="mt-3" variant="outline">{attendant.activeCount === attendantsWithLoad[0]?.activeCount ? 'menor fila' : 'disponível'}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="glass border-border/80 xl:col-span-2">
          <CardHeader>
            <CardTitle>Fila de ligações aguardando</CardTitle>
            <CardDescription>Veja os próximos clientes da fila, o motivo selecionado e a posição atual.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 max-w-md">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por protocolo ou cliente" data-testid="telephony-search-input" />
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {filteredSessions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhuma ligação aguardando.</div>
                ) : filteredSessions.map((session) => (
                  <div key={session.id} className="rounded-2xl border border-border bg-card/60 p-4" data-testid={`call-session-${session.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{session.clientName || 'Cliente'}</p>
                        <p className="text-xs text-muted-foreground">{session.protocolo}</p>
                      </div>
                      <Badge variant="outline">Fila {session.queuePosition || '-'}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Motivo: {session.selectedOptionLabel || session.selectedOptionDescription || 'Não informado'}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}