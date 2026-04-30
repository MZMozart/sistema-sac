import { NextRequest } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

export async function getServerUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('missing-auth-token')
  }

  const token = authHeader.replace('Bearer ', '')
  const decoded = await adminAuth.verifyIdToken(token)
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get()
  const userData = userSnap.exists ? userSnap.data() : null

  return {
    uid: decoded.uid,
    decoded,
    userData,
  }
}