import { beforeEach, describe, expect, it } from 'vitest'
import { rebalanceCallQueue } from '@/lib/call-queue'
import { failNextFirebaseCall, getFirebaseOperations, getMockCollection, resetFirebaseMocks } from '../mocks/firebase'

describe('rebalanceCallQueue', () => {
  beforeEach(() => {
    resetFirebaseMocks()
  })

  it('reordena chamadas aguardando pela data de criacao', async () => {
    resetFirebaseMocks({
      call_sessions: [
        { id: 'late', data: { companyId: 'company-1', callId: 'call-late', status: 'waiting', createdAt: { seconds: 20 }, queuePosition: 1 } },
        { id: 'early', data: { companyId: 'company-1', status: 'waiting', createdAt: { seconds: 10 }, queuePosition: 5 } },
        { id: 'other-company', data: { companyId: 'company-2', status: 'waiting', createdAt: { seconds: 1 }, queuePosition: 1 } },
      ],
      calls: [
        { id: 'call-late', data: { queuePosition: 1 } },
        { id: 'early', data: { queuePosition: 5 } },
      ],
    })

    await rebalanceCallQueue('company-1')

    expect(getMockCollection('call_sessions')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'early', queuePosition: 1 }),
        expect.objectContaining({ id: 'late', queuePosition: 2 }),
        expect.objectContaining({ id: 'other-company', queuePosition: 1 }),
      ])
    )
    expect(getMockCollection('calls')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'early', queuePosition: 1 }),
        expect.objectContaining({ id: 'call-late', queuePosition: 2 }),
      ])
    )
  })

  it('remove posicao de fila quando a chamada nao esta mais aguardando', async () => {
    resetFirebaseMocks({
      call_sessions: [
        { id: 'active-session', data: { companyId: 'company-1', callId: 'active-call', status: 'active', queuePosition: 3 } },
      ],
      calls: [
        { id: 'active-call', data: { queuePosition: 3 } },
      ],
    })

    await rebalanceCallQueue('company-1')

    expect(getMockCollection('call_sessions')).toEqual([
      expect.objectContaining({ id: 'active-session', queuePosition: null }),
    ])
    expect(getMockCollection('calls')).toEqual([
      expect.objectContaining({ id: 'active-call', queuePosition: null }),
    ])
  })

  it('propaga erro do Firestore para a tela tratar falhas de fila', async () => {
    failNextFirebaseCall('getDocs', new Error('firestore-offline'))

    await expect(rebalanceCallQueue('company-1')).rejects.toThrow('firestore-offline')
    expect(getFirebaseOperations().updateDoc).toHaveLength(0)
  })
})

