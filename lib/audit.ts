import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type AuditEventType =
  | 'chat_created'
  | 'chat_message'
  | 'chat_bot_reply'
  | 'chat_inactivity_prompt'
  | 'chat_transferred'
  | 'chat_assumed'
  | 'chat_closed'
  | 'chat_reopened'
  | 'chat_rating'
  | 'call_created'
  | 'call_answered'
  | 'call_menu_selected'
  | 'call_muted'
  | 'call_unmuted'
  | 'call_connection_drop'
  | 'call_reconnected'
  | 'call_message'
  | 'call_file_shared'
  | 'call_transfer_requested'
  | 'call_ended'
  | 'call_recording_saved'

export type AuditPayload = {
  protocol?: string
  chatId?: string
  callId?: string
  companyId: string
  companyName?: string
  clientId?: string | null
  clientName?: string | null
  employeeId?: string | null
  employeeName?: string | null
  eventType: AuditEventType
  channel: 'chat' | 'call'
  summary: string
  metadata?: Record<string, any>
}

export async function createAuditLog(payload: AuditPayload) {
  // Mantem uma trilha unica para chat e ligacao, facilitando auditoria por protocolo.
  await addDoc(collection(db, 'audit_logs'), {
    ...payload,
    metadata: payload.metadata || {},
    createdAt: serverTimestamp(),
  })
}
