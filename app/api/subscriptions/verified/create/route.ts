import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { getServerUser } from '@/lib/server-auth'

const PLAN_SLUG = 'verified_monthly'
const PLAN_AMOUNT = 49

function buildCheckoutUrl(baseUrl: string, values: Record<string, string>) {
  const url = new URL(baseUrl)
  Object.entries(values).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value)
  })
  return url.toString()
}

export async function POST(request: NextRequest) {
  try {
    const checkoutBaseUrl = process.env.KIWIFY_CHECKOUT_URL
    if (!checkoutBaseUrl) {
      return NextResponse.json({ error: 'kiwify-checkout-url-missing' }, { status: 500 })
    }

    const { userData, uid: userId } = await getServerUser(request)
    if (!userData?.companyId || !['owner', 'manager'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const companyRef = adminDb.collection('companies').doc(userData.companyId)
    const companySnap = await companyRef.get()
    if (!companySnap.exists) {
      return NextResponse.json({ error: 'company-not-found' }, { status: 404 })
    }

    const company = companySnap.data() || {}
    const companyName = company.nomeFantasia || company.razaoSocial || 'Empresa'
    const checkoutUrl = buildCheckoutUrl(checkoutBaseUrl, {
      src: 'atendepro_verified',
      s1: userData.companyId,
      s2: userId,
      s3: PLAN_SLUG,
      utm_source: 'atendepro',
      utm_medium: 'app',
      utm_campaign: 'selo_verificado',
    })

    await adminDb.collection('payment_transactions').add({
      company_id: userData.companyId,
      user_id: userId,
      provider: 'kiwify',
      type: 'subscription',
      plan_slug: PLAN_SLUG,
      amount: PLAN_AMOUNT,
      currency: 'brl',
      status: 'initiated',
      payment_status: 'pending',
      checkout_url: checkoutUrl,
      customer_email: userData.email || '',
      created_at: new Date().toISOString(),
      metadata: {
        companyName,
        tracking: { s1: userData.companyId, s2: userId, s3: PLAN_SLUG },
        benefits: ['verified_badge', 'premium_positioning', 'trust_boost'],
      },
    })

    return NextResponse.json({ url: checkoutUrl, provider: 'kiwify' })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'verified-plan-create-failed' }, { status: 500 })
  }
}
