import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/server-auth'

export async function POST(request: NextRequest) {
  try {
    const { userData } = await getServerUser(request)
    if (!userData?.companyId || !['owner', 'manager'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const portalUrl = process.env.KIWIFY_CUSTOMER_PORTAL_URL || process.env.KIWIFY_CHECKOUT_URL
    if (!portalUrl) {
      return NextResponse.json({ error: 'kiwify-portal-url-missing' }, { status: 500 })
    }

    return NextResponse.json({ url: portalUrl, provider: 'kiwify' })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'verified-plan-portal-failed' }, { status: 500 })
  }
}
