import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { DEFAULT_SECTOR_ID, normalizeSectorId } from '@/lib/sectors'

function toDateValue(value: any) {
  if (!value) return new Date(0)
  if (typeof value?.toDate === 'function') return value.toDate()
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed
}

export async function rebalanceChatQueue(companyId: string) {
  const snapshot = await getDocs(query(collection(db, 'chats'), where('companyId', '==', companyId)))
  const rows = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as any) }))
  const inactiveLimit = Date.now() - 30 * 60 * 1000

  const staleWaitingChats = rows.filter((chat) => {
    if (chat.status !== 'waiting') return false
    const reference = toDateValue(chat.clientHeartbeatAt || chat.lastActivity || chat.lastMessageAt || chat.updatedAt || chat.createdAt)
    return reference.getTime() < inactiveLimit
  })

  const waitingChats = rows
    .filter((chat) => chat.status === 'waiting' && !staleWaitingChats.some((stale) => stale.id === chat.id))
    .sort((a, b) => toDateValue(a.lastActivity || a.lastMessageAt || a.createdAt).getTime() - toDateValue(b.lastActivity || b.lastMessageAt || b.createdAt).getTime())

  const updates: Promise<void>[] = []

  staleWaitingChats.forEach((chat) => {
    updates.push(updateDoc(doc(db, 'chats', chat.id), {
      status: 'closed',
      queuePosition: null,
      closedBy: 'queue_cleanup',
      closedReason: 'Cliente inativo removido automaticamente da fila.',
      closedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
  })

  const sectorPositions = new Map<string, number>()
  waitingChats.forEach((chat) => {
    const sectorId = normalizeSectorId(chat.queueSectorId || chat.setor_id || DEFAULT_SECTOR_ID)
    const nextPosition = (sectorPositions.get(sectorId) || 0) + 1
    sectorPositions.set(sectorId, nextPosition)
    if (chat.queuePosition !== nextPosition || chat.queueSectorId !== sectorId) {
      updates.push(updateDoc(doc(db, 'chats', chat.id), { queuePosition: nextPosition, queueSectorId: sectorId }))
    }
  })

  rows
    .filter((chat) => chat.status !== 'waiting' && chat.queuePosition != null)
    .forEach((chat) => {
      updates.push(updateDoc(doc(db, 'chats', chat.id), { queuePosition: null }))
    })

  await Promise.all(updates)
  return waitingChats.findIndex((chat) => chat.id) >= 0 ? waitingChats : []
}
