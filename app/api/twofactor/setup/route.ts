import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { generateSecret, generateURI } from 'otplib'
import { getServerUser } from '@/lib/server-auth'
import { adminDb } from '@/lib/firebase-admin'

export async function POST(request: NextRequest) {
  try {
    const { uid, userData } = await getServerUser(request)
    const secret = generateSecret()
    const issuer = 'AtendePro'
    const label = userData?.email || uid
    const otpAuthUrl = generateURI({ issuer, label, secret })
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl)

    await adminDb.collection('users').doc(uid).set({
      pendingTwoFactorSecret: secret,
      pendingTwoFactorCreatedAt: new Date().toISOString(),
    }, { merge: true })

    return NextResponse.json({ secret, otpAuthUrl, qrCodeDataUrl })
  } catch (error: any) {
    const status = error?.message === 'missing-auth-token' ? 401 : 500
    return NextResponse.json({ error: error?.message || 'twofactor-setup-failed' }, { status })
  }
}