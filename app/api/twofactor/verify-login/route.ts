import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { verifyTwoFactorCode } from '@/lib/twofactor'

function isFirebaseQuotaError(error: any) {
  const message = String(error?.message || error || '').toLowerCase()
  return message.includes('resource_exhausted') || message.includes('quota exceeded')
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('missing-auth-token')
    }

    const decoded = await adminAuth.verifyIdToken(authHeader.replace('Bearer ', ''))
    const body = await request.json()
    const code = String(body.code || '').trim()
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get()
    const userData = userSnap.data()
    const secret = userData?.twoFactorSecret

    if (!verifyTwoFactorCode(code, secret)) {
      return NextResponse.json({ error: 'invalid-twofactor-code' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Falha ao validar login 2FA:', error?.message || error)
    const status = error?.message === 'missing-auth-token' ? 401 : isFirebaseQuotaError(error) ? 503 : 500
    const message = isFirebaseQuotaError(error) ? 'firebase-quota-exceeded' : error?.message
    return NextResponse.json({ error: message || 'twofactor-verify-login-failed' }, { status })
  }
}
