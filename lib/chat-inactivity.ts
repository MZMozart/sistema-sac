import { addDoc, collection, doc, increment, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createAuditLog } from '@/lib/audit'

function toDateValue(value: any) {
  if (!value) return new Date(0)
  if (typeof value?.toDate === 'function') return value.toDate()
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed
}

type InactivityInput = {
  chat: any
  companyName?: string
  messages: Array<{ senderType?: string; senderName?: string; content?: string; message?: string }>
}

export async function maybeHandleChatInactivity({ chat, companyName, messages }: InactivityInput) {
  if (!chat?.id || chat.status === 'closed') return

  const lastActivity = toDateValue(chat.lastActivity || chat.lastMessageAt || chat.createdAt)
  const secondsInactive = Math.max(0, Math.floor((Date.now() - lastActivity.getTime()) / 1000))
  const promptAfterSeconds = Number(chat?.inactivityPromptSeconds || 120)
  const closeAfterSeconds = Number(chat?.inactivityCloseSeconds || 300)
  const lastPromptAt = toDateValue(chat.lastInactivityPromptAt)
  const hasPromptAfterLastActivity = lastPromptAt.getTime() >= lastActivity.getTime() && lastPromptAt.getTime() > 0
  const lastMessage = messages[messages.length - 1]
  const inactiveActor = lastMessage?.senderType === 'client' ? 'employee' : 'client'
  const protocol = chat.protocolo || chat.id
  const botName = `${companyName || chat.companyName || 'Empresa'} BOT`

  if (!hasPromptAfterLastActivity && secondsInactive >= promptAfterSeconds) {
    const promptText = 'Você ainda está aí? Identifiquei inatividade no atendimento e vou aguardar sua resposta antes de encerrar.'

    await addDoc(collection(db, 'messages'), {
      chatId: chat.id,
      companyId: chat.companyId,
      content: promptText,
      type: 'text',
      senderType: 'bot',
      senderId: 'bot',
      senderName: botName,
      createdAt: serverTimestamp(),
      read: false,
    })

    await updateDoc(doc(db, 'chats', chat.id), {
      lastInactivityPromptAt: serverTimestamp(),
      inactiveActor,
      inactiveDurationSeconds: secondsInactive,
      inactiveCount: increment(1),
      lastMessage: promptText,
      lastMessageAt: serverTimestamp(),
    })

    await createAuditLog({
      companyId: chat.companyId,
      companyName: companyName || chat.companyName,
      protocol,
      chatId: chat.id,
      channel: 'chat',
      eventType: 'chat_inactivity_prompt',
      clientId: chat.clientId || null,
      clientName: chat.clientName || null,
      employeeId: chat.employeeId || null,
      employeeName: chat.employeeName || null,
      summary: 'BOT detectou inatividade no chat e perguntou se a parte ainda está presente.',
      metadata: { inactiveActor, inactiveDurationSeconds: secondsInactive },
    })
    return
  }

  if (hasPromptAfterLastActivity && secondsInactive >= closeAfterSeconds && chat.status !== 'closed') {
    const closedBy = inactiveActor === 'employee' ? 'employee_inactivity' : 'client_inactivity'
    const closeText = inactiveActor === 'employee'
      ? 'Encerrando por inatividade da equipe. O protocolo ficará registrado para auditoria e poderá ser retomado em um novo atendimento.'
      : 'Encerrando por inatividade do cliente. O protocolo ficará registrado para auditoria e poderá ser retomado em um novo atendimento.'

    await addDoc(collection(db, 'messages'), {
      chatId: chat.id,
      companyId: chat.companyId,
      content: closeText,
      type: 'text',
      senderType: 'bot',
      senderId: 'bot',
      senderName: botName,
      createdAt: serverTimestamp(),
      read: false,
    })

    await updateDoc(doc(db, 'chats', chat.id), {
      status: 'closed',
      closedBy,
      endedAt: serverTimestamp(),
      inactiveActor,
      inactiveDurationSeconds: secondsInactive,
      lastMessage: closeText,
      lastMessageAt: serverTimestamp(),
    })

    await createAuditLog({
      companyId: chat.companyId,
      companyName: companyName || chat.companyName,
      protocol,
      chatId: chat.id,
      channel: 'chat',
      eventType: 'chat_closed',
      clientId: chat.clientId || null,
      clientName: chat.clientName || null,
      employeeId: chat.employeeId || null,
      employeeName: chat.employeeName || null,
      summary: 'Chat encerrado automaticamente por inatividade.',
      metadata: { inactiveActor, inactiveDurationSeconds: secondsInactive, closedBy },
    })
  }
}