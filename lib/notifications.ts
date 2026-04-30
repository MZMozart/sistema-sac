import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type NotificationTarget = {
  recipientCompanyId?: string
  recipientUserId?: string
}

export type AppNotificationPayload = NotificationTarget & {
  title: string
  body: string
  type: 'chat' | 'call' | 'rating' | 'system'
  actionUrl?: string
  entityId?: string
  entityType?: 'chat' | 'call' | 'rating' | 'settings' | 'profile'
  actorName?: string
  targetUserId?: string
}

export function getNotificationDate(value: any) {
  if (!value) return new Date(0)
  if (typeof value?.toDate === 'function') return value.toDate()
  return new Date(value)
}

export async function createNotification(payload: AppNotificationPayload) {
  if (!payload.recipientCompanyId && !payload.recipientUserId) {
    return
  }

  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  )

  await addDoc(collection(db, 'notifications'), {
    ...cleanPayload,
    readAt: null,
    createdAt: serverTimestamp(),
  })
}