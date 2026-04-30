import { beforeEach, describe, expect, it } from 'vitest'
import { createAuditLog } from '@/lib/audit'
import { failNextFirebaseCall, getMockCollection, resetFirebaseMocks } from '../mocks/firebase'

describe('createAuditLog', () => {
  beforeEach(() => {
    resetFirebaseMocks()
  })

  it('cria log de auditoria com metadados e timestamp', async () => {
    await createAuditLog({
      companyId: 'company-1',
      companyName: 'AtendePro Demo',
      protocol: 'CHT-2026-ABC12345',
      chatId: 'chat-1',
      channel: 'chat',
      eventType: 'chat_created',
      clientId: 'client-1',
      clientName: 'Cliente Teste',
      summary: 'Chat criado no teste.',
    })

    expect(getMockCollection('audit_logs')).toEqual([
      expect.objectContaining({
        companyId: 'company-1',
        protocol: 'CHT-2026-ABC12345',
        channel: 'chat',
        eventType: 'chat_created',
        metadata: {},
        createdAt: { __type: 'serverTimestamp' },
      }),
    ])
  })

  it('preserva metadados informados no evento', async () => {
    await createAuditLog({
      companyId: 'company-1',
      callId: 'call-1',
      channel: 'call',
      eventType: 'call_menu_selected',
      summary: 'Cliente escolheu opcao 2.',
      metadata: { digit: '2', label: 'Financeiro' },
    })

    expect(getMockCollection('audit_logs')[0]).toEqual(
      expect.objectContaining({
        metadata: { digit: '2', label: 'Financeiro' },
      })
    )
  })

  it('propaga falha de escrita para o fluxo exibir erro', async () => {
    failNextFirebaseCall('addDoc', new Error('permission-denied'))

    await expect(
      createAuditLog({
        companyId: 'company-1',
        callId: 'call-1',
        channel: 'call',
        eventType: 'call_created',
        summary: 'Ligacao criada.',
      })
    ).rejects.toThrow('permission-denied')
  })
})

