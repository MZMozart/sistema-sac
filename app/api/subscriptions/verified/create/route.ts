import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { getServerUser } from '@/lib/server-auth'

const PLAN_NAME = 'Selo Verificado AtendePro'
const PLAN_SLUG = 'verified_monthly'
const PLAN_AMOUNT_CENTS = 4900

function toFormBody(values: Record<string, string>) {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => params.append(key, value))
  return params
}

export async function POST(request: NextRequest) {
  try {
    const stripeApiKey = process.env.STRIPE_API_KEY
    if (!stripeApiKey) {
      return NextResponse.json({ error: 'stripe-key-missing' }, { status: 500 })
    }

    const { userData, uid: userId } = await getServerUser(request)
    if (!userData?.companyId || !['owner', 'manager'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const { origin } = await request.json()
    if (!origin) {
      return NextResponse.json({ error: 'missing-origin' }, { status: 400 })
    }

    const companyRef = adminDb.collection('companies').doc(userData.companyId)
    const companySnap = await companyRef.get()
    if (!companySnap.exists) {
      return NextResponse.json({ error: 'company-not-found' }, { status: 404 })
    }

    const company = companySnap.data() || {}
    const companyName = company.nomeFantasia || company.razaoSocial || 'Empresa'
    const successUrl = `${origin}/dashboard/verified-plan?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${origin}/dashboard/verified-plan?cancelled=1`

    const body = toFormBody({
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      'payment_method_types[0]': 'card',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'brl',
      'line_items[0][price_data][unit_amount]': String(PLAN_AMOUNT_CENTS),
      'line_items[0][price_data][recurring][interval]': 'month',
      'line_items[0][price_data][product_data][name]': PLAN_NAME,
      'line_items[0][price_data][product_data][description]': `Plano premium para ${companyName}`,
      customer_email: userData.email || '',
      'metadata[companyId]': userData.companyId,
      'metadata[userId]': userId,
      'metadata[planSlug]': PLAN_SLUG,
      'metadata[companyName]': companyName,
      'subscription_data[metadata][companyId]': userData.companyId,
      'subscription_data[metadata][userId]': userId,
      'subscription_data[metadata][planSlug]': PLAN_SLUG,
      locale: 'pt-BR',
      'allow_promotion_codes': 'true',
      'billing_address_collection': 'required',
      client_reference_id: userData.companyId,
    })

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })

    const stripeData = await stripeResponse.json()
    if (!stripeResponse.ok) {
      return NextResponse.json({ error: stripeData?.error?.message || 'stripe-session-failed' }, { status: 500 })
    }

    await adminDb.collection('payment_transactions').add({
      company_id: userData.companyId,
      user_id: userId,
      provider: 'stripe',
      type: 'subscription',
      plan_slug: PLAN_SLUG,
      amount: 49,
      currency: 'brl',
      status: 'initiated',
      payment_status: stripeData.payment_status || 'unpaid',
      session_id: stripeData.id,
      session_url: stripeData.url,
      customer_email: userData.email || '',
      created_at: new Date().toISOString(),
      metadata: {
        companyName,
        benefits: ['verified_badge', 'premium_positioning', 'trust_boost'],
      },
    })

    return NextResponse.json({ url: stripeData.url, sessionId: stripeData.id })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'verified-plan-create-failed' }, { status: 500 })
  }
}
