import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { getServerUser } from '@/lib/server-auth'

export async function GET(request: NextRequest) {
  try {
    const { userData } = await getServerUser(request)
    if (!userData?.companyId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const companySnap = await adminDb.collection('companies').doc(userData.companyId).get()
    const company = companySnap.data() || {}

    return NextResponse.json({
      provider: 'kiwify',
      status: company.premiumVerificationStatus || 'pending',
      paid: Boolean(company.premiumVerificationActive),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'verified-plan-status-failed' }, { status: 500 })
  }
}
