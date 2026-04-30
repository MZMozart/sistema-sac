import { beforeEach, describe, expect, it } from 'vitest'
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { rebalanceCallQueue } from '@/lib/call-queue'
import { createAttendanceProtocol } from '@/lib/attendance-protocol'
import { getMockCollection, resetFirebaseMocks } from '../mocks/firebase'

describe('fluxo de ligacao', () => {
  beforeEach(() => {
    resetFirebaseMocks()
  })

  it('cria sessao, atualiza status e limpa a fila', async () => {
    const protocol = createAttendanceProtocol('CAL', new Date('2026-04-30T12:00:00Z'), 'call-1234-test')

    await setDoc(doc(db, 'call_sessions', 'session-1'), {
      id: 'session-1',
      callId: 'call-1',
      protocolo: protocol,
      companyId: 'company-1',
      status: 'waiting',
      queuePosition: 1,
      createdAt: serverTimestamp(),
    })
    await setDoc(doc(db, 'calls', 'call-1'), {
      id: 'call-1',
      protocolo: protocol,
      companyId: 'company-1',
      status: 'waiting',
      queuePosition: 1,
      createdAt: serverTimestamp(),
    })

    await rebalanceCallQueue('company-1')
    await updateDoc(doc(db, 'call_sessions', 'session-1'), { status: 'active' })
    await updateDoc(doc(db, 'calls', 'call-1'), { status: 'active' })
    await rebalanceCallQueue('company-1')

    expect(getMockCollection('call_sessions')).toEqual([
      expect.objectContaining({ id: 'session-1', status: 'active', queuePosition: null }),
    ])
    expect(getMockCollection('calls')).toEqual([
      expect.objectContaining({ id: 'call-1', status: 'active', queuePosition: null }),
    ])
  })
})
