import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/server-auth'
import { adminDb } from '@/lib/firebase-admin'

function serializeValue(value: any): any {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(serializeValue)
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeValue(item)]))
  }
  return value
}

export async function GET(request: NextRequest) {
  try {
    const { userData } = await getServerUser(request)
    const companyId = userData?.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'company-not-found' }, { status: 400 })
    }

    const [companySnap, employeesSnap, chatsSnap, callsSnap, ratingsSnap, logsSnap] = await Promise.all([
      adminDb.collection('companies').doc(companyId).get(),
      adminDb.collection('employees').where('companyId', '==', companyId).get(),
      adminDb.collection('chats').where('companyId', '==', companyId).get(),
      adminDb.collection('calls').where('companyId', '==', companyId).get(),
      adminDb.collection('ratings').where('companyId', '==', companyId).get(),
      adminDb.collection('logs').where('companyId', '==', companyId).get(),
    ])

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      company: companySnap.exists ? serializeValue(companySnap.data()) : null,
      employees: employeesSnap.docs.map((doc) => serializeValue({ id: doc.id, ...doc.data() })),
      chats: chatsSnap.docs.map((doc) => serializeValue({ id: doc.id, ...doc.data() })),
      calls: callsSnap.docs.map((doc) => serializeValue({ id: doc.id, ...doc.data() })),
      ratings: ratingsSnap.docs.map((doc) => serializeValue({ id: doc.id, ...doc.data() })),
      logs: logsSnap.docs.map((doc) => serializeValue({ id: doc.id, ...doc.data() })),
    })
  } catch (error: any) {
    const status = error?.message === 'missing-auth-token' ? 401 : 500
    return NextResponse.json({ error: error?.message || 'export-failed' }, { status })
  }
}