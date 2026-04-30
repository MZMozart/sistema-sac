'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, updateDoc, doc, where, increment } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createNotification } from '@/lib/notifications'
import { createAuditLog } from '@/lib/audit'
import { rebalanceChatQueue } from '@/lib/chat-queue'
import { maybeHandleChatInactivity } from '@/lib/chat-inactivity'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, ArrowRightLeft, Bot, CheckCircle2, ChevronDown, Clock, Info, MessageSquare, Send, UserRound, XCircle } from 'lucide-react'
import { toast } from 'sonner'

type ChatStatus = 'active' | 'waiting' | 'closed' | 'bot' | 'pending_resolution'

type ChatRecord = {
  id: string
  protocolo: string
  clientId: string
  clientName?: string
  clientEmail?: string
  employeeId?: string
  employeeName?: string | null
  companyId: string
  companyName?: string
  status: ChatStatus
  botResolved?: boolean
  closedBy?: string | null
  queuePosition?: number | null
  lastMessage?: string
  lastMessageAt?: any
  createdAt?: any
}

type AttendantRecord = {
  id: string
  userId: string
  name?: string
  email?: string
  role?: string
  isActive?: boolean
  activeCount?: number
}

type MessageRecord = {
  id: string
  senderType: 'client' | 'employee' | 'bot'
  senderName?: string
  content?: string
  message?: string
  createdAt?: any
  timestamp?: any
}

function getDateValue(value: any) {
  if (!value) return new Date()
  if (typeof value?.toDate === 'function') return value.toDate()
  return new Date(value)
}

export default function ChatsPage() {
  const searchParams = useSearchParams()
  const { company, user } = useAuth()
  const [chats, setChats] = useState<ChatRecord[]>([])
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [message, setMessage] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ChatStatus>('all')
  const [search, setSearch] = useState('')
  const [attendants, setAttendants] = useState<AttendantRecord[]>([])
  const [chatInfoDialogOpen, setChatInfoDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [transferSearch, setTransferSearch] = useState('')
  const [transferringUserId, setTransferringUserId] = useState<string | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const targetChat = searchParams.get('chat')
    if (targetChat) {
      setSelectedChatId(targetChat)
    }
  }, [searchParams])

  useEffect(() => {
    if (!company?.id) return
    const chatsQuery = query(collection(db, 'chats'), where('companyId', '==', company.id))
    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      const rows = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() } as ChatRecord))
        .sort((a, b) => getDateValue(b.lastMessageAt || b.createdAt).getTime() - getDateValue(a.lastMessageAt || a.createdAt).getTime())
      setChats(rows)
      if (selectedChatId && !rows.some((chat) => chat.id === selectedChatId)) {
        setSelectedChatId(null)
      }
    })

    return () => unsubscribe()
  }, [company?.id, selectedChatId])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || !selectedChatId) return

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    if (distanceFromBottom < 120) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages, selectedChatId])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || !selectedChatId) return

    container.scrollTop = container.scrollHeight
  }, [selectedChatId])

  useEffect(() => {
    if (!selectedChatId) return
    const messagesQuery = query(collection(db, 'messages'), where('chatId', '==', selectedChatId), orderBy('createdAt', 'asc'))
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as MessageRecord)))
    })
    return () => unsubscribe()
  }, [selectedChatId])

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

  const filteredChats = useMemo(
    () =>
      chats.filter((chat) => {
        const matchesStatus = statusFilter === 'all' || chat.status === statusFilter
        const haystack = `${chat.clientName || ''} ${chat.clientEmail || ''} ${chat.protocolo || ''}`.toLowerCase()
        const matchesSearch = haystack.includes(search.toLowerCase())
        return matchesStatus && matchesSearch
      }),
    [chats, statusFilter, search]
  )

  const selectedChat = filteredChats.find((chat) => chat.id === selectedChatId) || chats.find((chat) => chat.id === selectedChatId) || null
  useEffect(() => {
    if (!selectedChat || messages.length === 0) return

    const timer = window.setInterval(() => {
      maybeHandleChatInactivity({
        chat: selectedChat,
        companyName: selectedChat.companyName,
        messages,
      }).catch(() => null)
    }, 30000)

    return () => window.clearInterval(timer)
  }, [selectedChat, messages])
  const attendantsWithLoad = attendants
    .map((attendant) => ({
      ...attendant,
      activeCount: chats.filter((chat) => chat.employeeId === attendant.userId && ['active', 'waiting', 'pending_resolution'].includes(chat.status)).length,
    }))
    .sort((a, b) => a.activeCount - b.activeCount)
  const suggestedAttendant = attendantsWithLoad[0] || null
  const transferTargets = attendantsWithLoad.filter((attendant) => {
    const haystack = `${attendant.name || ''} ${attendant.email || ''}`.toLowerCase()
    return attendant.userId !== selectedChat?.employeeId && haystack.includes(transferSearch.toLowerCase())
  })

  const sendMessage = async () => {
    if (!selectedChat || !message.trim() || !user) return
    try {
      await addDoc(collection(db, 'messages'), {
        chatId: selectedChat.id,
        companyId: selectedChat.companyId,
        content: message.trim(),
        senderType: 'employee',
        senderId: user.uid,
        senderName: user.displayName || 'Atendente',
        createdAt: serverTimestamp(),
      })

      await updateDoc(doc(db, 'chats', selectedChat.id), {
        employeeId: selectedChat.employeeId || user.uid,
        status: 'active',
        queuePosition: null,
        lastMessage: message.trim(),
        lastMessageAt: serverTimestamp(),
        unreadCount: 0,
      })
      await rebalanceChatQueue(selectedChat.companyId)

      await createNotification({
        recipientUserId: selectedChat.clientId,
        title: 'Nova resposta da empresa',
        body: `${user.displayName || 'Atendente'} respondeu seu atendimento ${selectedChat.protocolo}.`,
        type: 'chat',
        actionUrl: `/cliente/chat/${selectedChat.id}`,
        entityId: selectedChat.id,
        entityType: 'chat',
        actorName: user.displayName || 'Atendente',
      })
      await createAuditLog({
        companyId: selectedChat.companyId,
        companyName: selectedChat.companyName,
        protocol: selectedChat.protocolo,
        chatId: selectedChat.id,
        channel: 'chat',
        eventType: 'chat_message',
        employeeId: user.uid,
        employeeName: user.displayName || 'Atendente',
        clientId: selectedChat.clientId,
        clientName: selectedChat.clientName || null,
        summary: 'Atendente respondeu o cliente.',
        metadata: { message: message.trim() },
      })
      setMessage('')
    } catch {
      toast.error('Não foi possível enviar a mensagem.')
    }
  }

  const assumeChat = async (chat: ChatRecord) => {
    if (!user) return
    try {
      await updateDoc(doc(db, 'chats', chat.id), {
        employeeId: user.uid,
        employeeName: user.displayName || 'Atendente',
        status: 'active',
        queuePosition: null,
        lastActivity: serverTimestamp(),
      })

      if (!chat.employeeId && company?.id) {
        await updateDoc(doc(db, 'employees', `${company.id}_${user.uid}`), {
          totalChats: increment(1),
        })
      }

      await createNotification({
        recipientUserId: chat.clientId,
        title: 'Seu atendimento foi assumido',
        body: `${user.displayName || 'Atendente'} assumiu o protocolo ${chat.protocolo}.`,
        type: 'chat',
        actionUrl: `/cliente/chat/${chat.id}`,
        entityId: chat.id,
        entityType: 'chat',
        actorName: user.displayName || 'Atendente',
      })
      await createAuditLog({
        companyId: chat.companyId,
        companyName: chat.companyName,
        protocol: chat.protocolo,
        chatId: chat.id,
        channel: 'chat',
        eventType: 'chat_assumed',
        employeeId: user.uid,
        employeeName: user.displayName || 'Atendente',
        clientId: chat.clientId,
        clientName: chat.clientName || null,
        summary: 'Atendimento assumido por um atendente humano.',
      })
      await rebalanceChatQueue(chat.companyId)
      setSelectedChatId(chat.id)
    } catch {
      toast.error('Não foi possível assumir este atendimento.')
    }
  }

  const closeChat = async () => {
    if (!selectedChat) return
    try {
      await addDoc(collection(db, 'messages'), {
        chatId: selectedChat.id,
        companyId: selectedChat.companyId,
        content: 'Seu problema foi resolvido? Responda usando Sim ou Não para encerrar com avaliação.',
        senderType: 'bot',
        senderId: 'bot',
        senderName: 'BOT de encerramento',
        createdAt: serverTimestamp(),
      })

      await updateDoc(doc(db, 'chats', selectedChat.id), {
        status: 'pending_resolution',
        queuePosition: null,
        resolutionRequestedAt: serverTimestamp(),
        closureRequestedBy: 'employee',
      })
      await rebalanceChatQueue(selectedChat.companyId)

      await createNotification({
        recipientUserId: selectedChat.clientId,
        title: 'Confirmação de encerramento pendente',
        body: `O protocolo ${selectedChat.protocolo} aguarda sua confirmação para encerrar e avaliar o atendimento.`,
        type: 'chat',
        actionUrl: `/cliente/chat/${selectedChat.id}`,
        entityId: selectedChat.id,
        entityType: 'chat',
      })
      await createAuditLog({
        companyId: selectedChat.companyId,
        companyName: selectedChat.companyName,
        protocol: selectedChat.protocolo,
        chatId: selectedChat.id,
        channel: 'chat',
        eventType: 'chat_closed',
        employeeId: selectedChat.employeeId || null,
        employeeName: selectedChat.employeeName || null,
        clientId: selectedChat.clientId,
        clientName: selectedChat.clientName || null,
        summary: 'Atendente solicitou confirmação de encerramento do atendimento.',
      })
    } catch {
      toast.error('Não foi possível encerrar o chat.')
    }
  }

  const transferChat = async (target: AttendantRecord) => {
    if (!selectedChat) return
    try {
      setTransferringUserId(target.userId)
      await updateDoc(doc(db, 'chats', selectedChat.id), {
        employeeId: target.userId,
        employeeName: target.name || target.email || 'Atendente',
        status: 'waiting',
        lastActivity: serverTimestamp(),
      })
      await rebalanceChatQueue(selectedChat.companyId)
      await createNotification({
        recipientCompanyId: selectedChat.companyId,
        recipientUserId: target.userId,
        title: 'Chat transferido para você',
        body: `O protocolo ${selectedChat.protocolo} foi transferido para a sua fila.`,
        type: 'chat',
        actionUrl: `/dashboard/chats?chat=${selectedChat.id}`,
        entityId: selectedChat.id,
        entityType: 'chat',
      })
      await createAuditLog({
        companyId: selectedChat.companyId,
        companyName: selectedChat.companyName,
        protocol: selectedChat.protocolo,
        chatId: selectedChat.id,
        channel: 'chat',
        eventType: 'chat_transferred',
        employeeId: target.userId,
        employeeName: target.name || target.email || null,
        clientId: selectedChat.clientId,
        clientName: selectedChat.clientName || null,
        summary: 'Atendimento transferido para outro atendente.',
        metadata: { suggestedByQueue: suggestedAttendant?.userId === target.userId },
      })
      toast.success('Atendimento transferido com sucesso.')
      setTransferDialogOpen(false)
      setTransferSearch('')
    } catch {
      toast.error('Não foi possível transferir este atendimento agora.')
    } finally {
      setTransferringUserId(null)
    }
  }

  const nextClient = async () => {
    const nextWaiting = [...chats]
      .filter((chat) => ['waiting', 'bot'].includes(chat.status))
      .sort((a, b) => (Number(a.queuePosition || 9999) - Number(b.queuePosition || 9999)) || new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())[0]
    if (nextWaiting) {
      await assumeChat(nextWaiting)
    } else {
      toast.message('Nenhum cliente aguardando na fila agora.')
    }
  }

  const statusBadge = (status: ChatStatus) => {
    if (status === 'active') return <Badge className="bg-emerald-500/15 text-emerald-400"><CheckCircle2 className="mr-1 h-3 w-3" />Ativo</Badge>
    if (status === 'waiting') return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />Fila</Badge>
    if (status === 'bot') return <Badge className="bg-sky-500/15 text-sky-400"><Bot className="mr-1 h-3 w-3" />BOT</Badge>
    if (status === 'pending_resolution') return <Badge className="bg-amber-500/15 text-amber-400"><Clock className="mr-1 h-3 w-3" />Confirmação</Badge>
    return <Badge variant="secondary"><XCircle className="mr-1 h-3 w-3" />Encerrado</Badge>
  }

  return (
    <div className="grid h-[calc(100vh-6rem)] min-h-0 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className={`glass border-border/80 ${selectedChat ? 'hidden xl:flex' : 'flex'} min-h-0 flex-col overflow-hidden`}>
        <CardHeader className="shrink-0 border-b border-border/70">
          <CardTitle>Fila real de chats</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por cliente ou protocolo" data-testid="dashboard-chat-search-input" />
          <div className="flex flex-wrap gap-2">
            {['all', 'waiting', 'active', 'bot', 'pending_resolution', 'closed'].map((status) => (
              <Button key={status} variant={statusFilter === status ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(status as any)} data-testid={`dashboard-chat-filter-${status}`}>
                {status}
              </Button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-3" data-testid="dashboard-chat-list-scroll">
            <div className="space-y-3">
              {filteredChats.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Nenhuma conversa disponível com esse filtro.
                </div>
              ) : filteredChats.map((chat) => (
                <button key={chat.id} onClick={() => setSelectedChatId(chat.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedChatId === chat.id ? 'border-primary bg-primary/5' : 'border-border bg-card/60'}`} data-testid={`dashboard-chat-item-${chat.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{chat.clientName || 'Cliente'}</p>
                      <p className="text-xs text-muted-foreground">{chat.protocolo}</p>
                    </div>
                    {statusBadge(chat.status)}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{chat.lastMessage || 'Sem mensagens ainda'}</p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={`glass border-border/80 ${selectedChat ? 'flex' : 'hidden xl:flex'} min-h-0 flex-col overflow-hidden`}>
        <CardHeader className="shrink-0 border-b border-border/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              {selectedChat ? (
                <Button variant="ghost" size="sm" className="mb-3 inline-flex xl:hidden" onClick={() => setSelectedChatId(null)} data-testid="dashboard-chat-mobile-back-button">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para a fila
                </Button>
              ) : null}
              <CardTitle>{selectedChat?.clientName || 'Selecione um chat'}</CardTitle>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                {selectedChat ? statusBadge(selectedChat.status) : null}
                {selectedChat?.clientEmail ? <span>{selectedChat.clientEmail}</span> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="hidden flex-wrap gap-2 lg:flex">
                {selectedChat && selectedChat.status !== 'active' ? (
                  <Button onClick={() => assumeChat(selectedChat)} data-testid="dashboard-chat-assume-button">Assumir</Button>
                ) : null}
                {selectedChat ? (
                  <>
                    <Button variant="outline" onClick={() => setChatInfoDialogOpen(true)} data-testid="dashboard-chat-open-info-button">
                      <Info className="mr-2 h-4 w-4" />
                      Informações
                    </Button>
                    <Button variant="outline" onClick={() => setTransferDialogOpen(true)} data-testid="dashboard-chat-open-transfer-button">
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      Transferir
                    </Button>
                  </>
                ) : null}
                <Button variant="outline" onClick={nextClient} data-testid="dashboard-chat-next-button">Próximo cliente</Button>
                {selectedChat ? <Button variant="destructive" onClick={closeChat} data-testid="dashboard-chat-close-button">Encerrar</Button> : null}
              </div>

              <div className="lg:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" data-testid="dashboard-chat-mobile-actions-trigger">
                      Ações
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" data-testid="dashboard-chat-mobile-actions-menu">
                    <DropdownMenuItem onClick={() => setChatInfoDialogOpen(true)} data-testid="dashboard-chat-mobile-info-action">
                      <Info className="h-4 w-4" />
                      Informações do chat
                    </DropdownMenuItem>
                    {selectedChat ? (
                      <DropdownMenuItem onClick={() => setTransferDialogOpen(true)} data-testid="dashboard-chat-mobile-transfer-action">
                        <ArrowRightLeft className="h-4 w-4" />
                        Transferir
                      </DropdownMenuItem>
                    ) : null}
                    {selectedChat && selectedChat.status !== 'active' ? (
                      <DropdownMenuItem onClick={() => assumeChat(selectedChat)} data-testid="dashboard-chat-mobile-assume-action">
                        <CheckCircle2 className="h-4 w-4" />
                        Assumir agora
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={nextClient} data-testid="dashboard-chat-mobile-next-action">
                      <Clock className="h-4 w-4" />
                      Próximo cliente
                    </DropdownMenuItem>
                    {selectedChat ? (
                      <DropdownMenuItem onClick={closeChat} data-testid="dashboard-chat-mobile-close-action">
                        <XCircle className="h-4 w-4" />
                        Encerrar atendimento
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {!selectedChat ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-40" />
                O chat só abre quando você clicar em uma conversa da fila.
              </div>
            </div>
          ) : (
            <>
              <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6" data-testid="dashboard-chat-messages-scroll">
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const sender = msg.senderType === 'client' ? 'justify-start' : 'justify-end'
                    const bubble = msg.senderType === 'client' ? 'bg-secondary text-foreground' : msg.senderType === 'bot' ? 'bg-sky-500/12 text-sky-100' : 'bg-gradient-primary text-white'
                    return (
                      <div key={msg.id} className={`flex ${sender}`}>
                        <div className={`max-w-[75%] rounded-3xl px-4 py-3 shadow-sm ${bubble}`} data-testid={`dashboard-chat-message-${msg.id}`}>
                          <div className="mb-1 text-[11px] uppercase tracking-[0.2em] opacity-70">{msg.senderName || msg.senderType}</div>
                          <p className="text-sm whitespace-pre-wrap">{msg.content || msg.message || ''}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="shrink-0 border-t border-border p-4">
                <div className="flex gap-3">
                  <Input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} placeholder="Digite sua resposta para o cliente" data-testid="dashboard-chat-message-input" />
                  <Button onClick={sendMessage} data-testid="dashboard-chat-send-button"><Send className="h-4 w-4" /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={chatInfoDialogOpen} onOpenChange={setChatInfoDialogOpen}>
        <DialogContent data-testid="dashboard-chat-info-dialog">
          <DialogHeader>
            <DialogTitle>Informações do chat</DialogTitle>
            <DialogDescription>
              Detalhes rápidos do atendimento sem ocupar a tela principal do chat.
            </DialogDescription>
          </DialogHeader>
          {selectedChat ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card/60 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Protocolo</p>
                <p className="mt-2 text-sm font-semibold" data-testid="dashboard-chat-info-protocol">{selectedChat.protocolo}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card/60 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Cliente</p>
                <p className="mt-2 text-sm font-semibold">{selectedChat.clientName || 'Cliente'}</p>
                <p className="text-xs text-muted-foreground">{selectedChat.clientEmail || 'Sem email'}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card/60 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Atendimento</p>
                <p className="mt-2 text-sm font-semibold">{selectedChat.employeeName || 'Ainda sem atendente'}</p>
                <p className="text-xs text-muted-foreground">Status: {selectedChat.status}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card/60 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Fila e eventos</p>
                <p className="mt-2 text-xs text-muted-foreground">Posição: {selectedChat.queuePosition || 'sem fila'} • Encerramento: {selectedChat.closedBy || 'em andamento'}</p>
                <p className="mt-2 text-xs text-muted-foreground">Transferências: {(selectedChat as any).transferCount || 0} • Inatividade: {(selectedChat as any).inactiveCount || 0}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card/60 p-4 sm:col-span-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <UserRound className="h-3.5 w-3.5" />
                  {selectedChat.employeeId ? 'Atendimento atribuído a um atendente.' : 'Ainda sem atendente fixo.'}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent data-testid="dashboard-chat-transfer-dialog">
          <DialogHeader>
            <DialogTitle>Transferir atendimento</DialogTitle>
            <DialogDescription>
              Escolha o atendente ideal para receber o protocolo {selectedChat?.protocolo || '--'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sugestão automática</p>
                  <p className="mt-2 font-semibold" data-testid="dashboard-chat-transfer-suggestion-name">{suggestedAttendant?.name || suggestedAttendant?.email || 'Sem sugestão disponível'}</p>
                </div>
                <Badge variant="outline" data-testid="dashboard-chat-transfer-suggestion-badge">
                  {suggestedAttendant ? `${suggestedAttendant.activeCount || 0} ativos` : 'Fila indisponível'}
                </Badge>
              </div>
            </div>
            <Input
              value={transferSearch}
              onChange={(event) => setTransferSearch(event.target.value)}
              placeholder="Buscar atendente por nome ou e-mail"
              data-testid="dashboard-chat-transfer-search-input"
            />
            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1" data-testid="dashboard-chat-transfer-list">
              {transferTargets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Nenhum atendente disponível para essa transferência.
                </div>
              ) : transferTargets.map((attendant) => (
                <div key={attendant.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/80 p-4" data-testid={`dashboard-chat-transfer-row-${attendant.userId}`}>
                  <div>
                    <p className="text-sm font-semibold">{attendant.name || attendant.email || 'Atendente'}</p>
                    <p className="text-xs text-muted-foreground">{attendant.email || 'Sem e-mail'} • {attendant.activeCount || 0} chats ativos</p>
                  </div>
                  <Button
                    size="sm"
                    variant={attendant.userId === suggestedAttendant?.userId ? 'default' : 'outline'}
                    onClick={() => transferChat(attendant)}
                    disabled={transferringUserId === attendant.userId}
                    data-testid={`dashboard-chat-transfer-confirm-${attendant.userId}`}
                  >
                    {transferringUserId === attendant.userId ? 'Transferindo...' : 'Transferir'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}