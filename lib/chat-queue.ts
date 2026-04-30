import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

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

  const waitingChats = rows
    .filter((chat) => chat.status === 'waiting')
    .sort((a, b) => toDateValue(a.lastActivity || a.lastMessageAt || a.createdAt).getTime() - toDateValue(b.lastActivity || b.lastMessageAt || b.createdAt).getTime())

  const updates: Promise<void>[] = []

  waitingChats.forEach((chat, index) => {
    if (chat.queuePosition !== index + 1) {
      updates.push(updateDoc(doc(db, 'chats', chat.id), { queuePosition: index + 1 }))
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