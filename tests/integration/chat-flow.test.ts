import { beforeEach, describe, expect, it } from 'vitest'
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createAuditLog } from '@/lib/audit'
import { createAttendanceProtocol } from '@/lib/attendance-protocol'
import { getMockCollection, resetFirebaseMocks } from '../mocks/firebase'

describe('fluxo de chat', () => {
  beforeEach(() => {
    resetFirebaseMocks()
  })

  it('cria chat, envia mensagem inicial e persiste auditoria', async () => {
    const protocol = createAttendanceProtocol('CHT', new Date('2026-04-30T12:00:00Z'), 'chat-1234-test')
    const chatRef = await addDoc(collection(db, 'chats'), {
      protocolo: protocol,
      companyId: 'company-1',
      clientId: 'client-1',
      status: 'bot',
      createdAt: serverTimestamp(),
    })

    await addDoc(collection(db, 'messages'), {
      chatId: chatRef.id,
      companyId: 'company-1',
      content: 'Ola, como posso ajudar?',
      senderType: 'bot',
      createdAt: serverTimestamp(),
    })

    await createAuditLog({
      companyId: 'company-1',
      chatId: chatRef.id,
      protocol,
      channel: 'chat',
      eventType: 'chat_created',
      summary: 'Chat criado no fluxo de integracao.',
    })

    const messages = await getDocs(query(collection(db, 'messages'), where('chatId', '==', chatRef.id)))

    expect(getMockCollection('chats')).toEqual([
      expect.objectContaining({ id: chatRef.id, protocolo: protocol, status: 'bot' }),
    ])
    expect(messages.docs.map((doc) => doc.data())).toEqual([
      expect.objectContaining({ content: 'Ola, como posso ajudar?', senderType: 'bot' }),
    ])
    expect(getMockCollection('audit_logs')).toEqual([
      expect.objectContaining({ chatId: chatRef.id, eventType: 'chat_created' }),
    ])
  })
})
