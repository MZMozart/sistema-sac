import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

function toDateValue(value: any) {
  if (!value) return new Date(0)
  if (typeof value?.toDate === 'function') return value.toDate()
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed
}

export async function rebalanceCallQueue(companyId: string) {
  const snapshot = await getDocs(query(collection(db, 'call_sessions'), where('companyId', '==', companyId)))
  const rows = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as any) }))
  const activeLimit = Date.now() - 45000

  const staleWaitingCalls = rows.filter((call) => {
    if (call.status !== 'waiting') return false
    if (call.clientConnected === false) return true
    if (!call.clientHeartbeatAt) return false
    return toDateValue(call.clientHeartbeatAt).getTime() < activeLimit
  })

  // A fila considera apenas ligacoes aguardando atendimento com cliente ativo e preserva a ordem de chegada.
  const waitingCalls = rows
    .filter((call) => call.status === 'waiting' && !staleWaitingCalls.some((stale) => stale.id === call.id))
    .sort((a, b) => toDateValue(a.createdAt).getTime() - toDateValue(b.createdAt).getTime())

  const updates: Promise<void>[] = []

  staleWaitingCalls.forEach((call) => {
    updates.push(updateDoc(doc(db, 'call_sessions', call.id), {
      status: 'ended',
      queuePosition: null,
      endedAt: serverTimestamp(),
      closedBy: 'queue_cleanup',
      updatedAt: serverTimestamp(),
    }))
    updates.push(updateDoc(doc(db, 'calls', call.callId || call.id), {
      status: 'ended',
      queuePosition: null,
      endedAt: serverTimestamp(),
      closedBy: 'queue_cleanup',
      updatedAt: serverTimestamp(),
    }))
  })

  waitingCalls.forEach((call, index) => {
    if (call.queuePosition !== index + 1) {
      updates.push(updateDoc(doc(db, 'call_sessions', call.id), { queuePosition: index + 1 }))
      updates.push(updateDoc(doc(db, 'calls', call.callId || call.id), { queuePosition: index + 1 }))
    }
  })

  rows
    .filter((call) => call.status !== 'waiting' && call.queuePosition != null)
    .forEach((call) => {
      updates.push(updateDoc(doc(db, 'call_sessions', call.id), { queuePosition: null }))
      updates.push(updateDoc(doc(db, 'calls', call.callId || call.id), { queuePosition: null }))
    })

  await Promise.all(updates)
}
