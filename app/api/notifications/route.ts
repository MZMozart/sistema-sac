import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/server-auth'
import { adminDb } from '@/lib/firebase-admin'

function serializeDate(value: any) {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  return new Date(value).toISOString()
}

async function loadNotifications(companyId?: string, uid?: string) {
  const query = companyId
    ? adminDb.collection('notifications').where('recipientCompanyId', '==', companyId)
    : adminDb.collection('notifications').where('recipientUserId', '==', uid)

  const snapshot = await query.get()
  return snapshot.docs
    .map((item) => ({
      id: item.id,
      ...item.data(),
      createdAt: serializeDate(item.data().createdAt),
      readAt: serializeDate(item.data().readAt),
    }))
    .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 30)
}

export async function GET(request: NextRequest) {
  try {
    const { uid, userData } = await getServerUser(request)
    const notifications = await loadNotifications(userData?.accountType === 'pj' ? userData?.companyId : undefined, uid)
    return NextResponse.json({ notifications })
  } catch (error: any) {
    const status = error?.message === 'missing-auth-token' ? 401 : 500
    return NextResponse.json({ error: error?.message || 'notifications-load-failed' }, { status })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { uid, userData } = await getServerUser(request)
    const body = await request.json().catch(() => ({}))
    const requestedIds = Array.isArray(body.ids) ? body.ids : []
    const notifications = await loadNotifications(userData?.accountType === 'pj' ? userData?.companyId : undefined, uid)
    const allowedIds = requestedIds.length > 0 ? notifications.filter((item: any) => requestedIds.includes(item.id)).map((item: any) => item.id) : notifications.map((item: any) => item.id)

    const batch = adminDb.batch()
    allowedIds.forEach((id: string) => {
      batch.update(adminDb.collection('notifications').doc(id), { readAt: new Date().toISOString() })
    })
    await batch.commit()

    return NextResponse.json({ ok: true, updated: allowedIds.length })
  } catch (error: any) {
    const status = error?.message === 'missing-auth-token' ? 401 : 500
    return NextResponse.json({ error: error?.message || 'notifications-update-failed' }, { status })
  }
}