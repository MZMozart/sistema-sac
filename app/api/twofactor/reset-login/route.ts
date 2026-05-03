import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/server-auth'
import { adminDb } from '@/lib/firebase-admin'

export async function POST(request: NextRequest) {
  try {
    const { uid } = await getServerUser(request)
    await adminDb.collection('users').doc(uid).set({
      twoFactorEnabled: false,
      twoFactorSecret: null,
      pendingTwoFactorSecret: null,
      pendingTwoFactorCreatedAt: null,
      twoFactorResetAt: new Date().toISOString(),
    }, { merge: true })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    const status = error?.message === 'missing-auth-token' ? 401 : 500
    return NextResponse.json({ error: error?.message || 'twofactor-reset-login-failed' }, { status })
  }
}
