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
    const userData = userSnap.data()
    const secret = userData?.twoFactorSecret

    if (!verifyTwoFactorCode(code, secret)) {
      return NextResponse.json({ error: 'invalid-twofactor-code' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Falha ao validar login 2FA:', error?.message || error)
    const status = error?.message === 'missing-auth-token' ? 401 : 500
    return NextResponse.json({ error: error?.message || 'twofactor-verify-login-failed' }, { status })
  }
}
