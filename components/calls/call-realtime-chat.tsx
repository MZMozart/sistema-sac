'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { Download, Loader2, Paperclip, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { db, storage } from '@/lib/firebase'
import { createNotification } from '@/lib/notifications'
import { createAuditLog } from '@/lib/audit'
import { toast } from 'sonner'

type CallChatMessage = {
  id: string
  roomId: string
  callId: string
  senderType: 'client' | 'employee'
  senderId: string
  senderName: string
  content?: string
  fileName?: string | null
  fileUrl?: string | null
  createdAt?: any
}

type CallRealtimeChatProps = {
  roomId: string
  callId: string
  protocol: string
  companyId: string
  companyName: string
  currentUserId: string
  currentUserName: string
  senderType: 'client' | 'employee'
  clientId?: string | null
  employeeId?: string | null
  compact?: boolean
}

function toDate(value: any) {
  if (!value) return new Date(0)
  if (typeof value?.toDate === 'function') return value.toDate()
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000)
  return new Date(value)
}

export function CallRealtimeChat({
  roomId,
  callId,
  protocol,
  companyId,
  companyName,
  currentUserId,
  currentUserName,
  senderType,
  clientId,
  employeeId,
  compact = false,
}: CallRealtimeChatProps) {
  const [messages, setMessages] = useState<CallChatMessage[]>([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const messagesQuery = query(collection(db, 'call_messages'), where('roomId', '==', roomId))
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const rows = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as any) } as CallChatMessage))
        .sort((a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime())
      setMessages(rows)
    })

    return () => unsubscribe()
  }, [roomId])

  const recipientUserId = useMemo(() => (senderType === 'employee' ? clientId : employeeId), [clientId, employeeId, senderType])

  const persistMessage = async (payload: { content?: string; file?: File | null }) => {
    const trimmedContent = payload.content?.trim() || ''
    if (!trimmedContent && !payload.file) return

    setSending(true)
    try {
      let fileUrl: string | null = null
      let fileName: string | null = null

      if (payload.file) {
        fileName = payload.file.name
        const safeName = `${Date.now()}-${payload.file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
        const fileRef = ref(storage, `call-chat/${companyId}/${callId}/${safeName}`)
        await uploadBytes(fileRef, payload.file)
        fileUrl = await getDownloadURL(fileRef)
      }

      await addDoc(collection(db, 'call_messages'), {
        roomId,
        callId,
        protocol,
        companyId,
        companyName,
        senderType,
        senderId: currentUserId,
        senderName: currentUserName,
        content: trimmedContent || null,
        fileName,
        fileUrl,
        createdAt: serverTimestamp(),
      })

      await updateDoc(doc(db, 'calls', callId), {
        lastCallChatMessage: trimmedContent || fileName || 'Arquivo compartilhado',
        lastCallChatSenderName: currentUserName,
        lastCallChatMessageAt: serverTimestamp(),
      })

      if (recipientUserId || companyId) {
        await createNotification({
          recipientCompanyId: senderType === 'client' ? companyId : undefined,
          recipientUserId: recipientUserId || undefined,
          title: fileUrl ? 'Novo arquivo na ligação' : 'Nova mensagem na ligação',
          body: fileUrl
            ? `${currentUserName} compartilhou ${fileName || 'um arquivo'} durante a ligação ${protocol}.`
            : `${currentUserName} enviou uma mensagem durante a ligação ${protocol}.`,
          type: 'call',
          actionUrl: senderType === 'employee' ? `/cliente/call/${roomId}` : '/dashboard/telephony',
          entityId: callId,
          entityType: 'call',
          actorName: currentUserName,
        })
      }

      await createAuditLog({
        companyId,
        companyName,
        protocol,
        callId,
        channel: 'call',
        eventType: fileUrl ? 'call_file_shared' : 'call_message',
        clientId: clientId || null,
        employeeId: employeeId || null,
        employeeName: senderType === 'employee' ? currentUserName : null,
        clientName: senderType === 'client' ? currentUserName : null,
        summary: fileUrl
          ? `${currentUserName} compartilhou um arquivo durante a ligação.`
          : `${currentUserName} enviou uma mensagem paralela durante a ligação.`,
        metadata: {
          content: trimmedContent || null,
          fileName,
          fileUrl,
        },
      })

      setMessage('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível enviar a mensagem da ligação agora.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="call-realtime-chat-panel">
      <div className="shrink-0 border-b border-border px-4 py-4">
        <h3 className="font-semibold" data-testid="call-realtime-chat-title">Chat ao vivo da ligação</h3>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="call-realtime-chat-subtitle">
          Troque texto e arquivos sem sair da chamada.
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-4 py-4" data-testid="call-realtime-chat-scroll-area">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-testid="call-realtime-chat-empty-state">
              Nenhuma mensagem trocada durante esta ligação ainda.
            </div>
          ) : messages.map((item) => {
            const mine = item.senderId === currentUserId
            return (
              <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`} data-testid={`call-realtime-chat-message-${item.id}`}>
                <div className={`max-w-[82%] rounded-3xl px-4 py-3 ${mine ? 'bg-gradient-primary text-white' : 'bg-card/80 text-foreground'}`}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] opacity-75">
                    <span>{item.senderName}</span>
                    <span>{toDate(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {item.content ? <p className="whitespace-pre-wrap text-sm">{item.content}</p> : null}
                  {item.fileUrl ? (
                    <a
                      href={item.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${mine ? 'border-white/20 bg-white/10 text-white' : 'border-border bg-background/80 text-foreground'}`}
                      data-testid={`call-realtime-chat-download-${item.id}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      {item.fileName || 'Baixar arquivo'}
                    </a>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-border p-4">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(event) => persistMessage({ file: event.target.files?.[0] || null })}
            data-testid="call-realtime-chat-file-input"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            data-testid="call-realtime-chat-attach-button"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && !compact && persistMessage({ content: message })}
            placeholder="Digite uma mensagem paralela da ligação"
            disabled={sending}
            data-testid="call-realtime-chat-input"
          />
          <Button
            type="button"
            onClick={() => persistMessage({ content: message })}
            disabled={!message.trim() || sending}
            data-testid="call-realtime-chat-send-button"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}