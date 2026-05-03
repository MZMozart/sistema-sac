import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/server-auth'
import { adminDb } from '@/lib/firebase-admin'
import { verifyTwoFactorCode } from '@/lib/twofactor'

export async function POST(request: NextRequest) {
  try {
    const { uid } = await getServerUser(request)
    const body = await request.json()
    const code = String(body.code || '').trim()
    const userSnap = await adminDb.collection('users').doc(uid).get()
    const secret = userSnap.data()?.twoFactorSecret

    if (!verifyTwoFactorCode(code, secret)) {
      return NextResponse.json({ error: 'invalid-twofactor-code' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    const status = error?.message === 'missing-auth-token' ? 401 : 500
    return NextResponse.json({ error: error?.message || 'twofactor-verify-login-failed' }, { status })
  }
}
