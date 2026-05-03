import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { getServerUser } from '@/lib/server-auth'

function toFormBody(values: Record<string, string>) {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => params.append(key, value))
  return params
}

export async function POST(request: NextRequest) {
  try {
    const stripeApiKey = process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET_KEY
    if (!stripeApiKey) {
      return NextResponse.json({ error: 'stripe-key-missing' }, { status: 500 })
    }

    const { userData } = await getServerUser(request)
    if (!userData?.companyId || !['owner', 'manager'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const { origin } = await request.json()
    if (!origin) {
      return NextResponse.json({ error: 'missing-origin' }, { status: 400 })
    }

    const companySnap = await adminDb.collection('companies').doc(userData.companyId).get()
    const companyData = companySnap.data() || {}

    let customerId = companyData.premiumVerificationCustomerId || null
    if (!customerId) {
      const transactionSnap = await adminDb.collection('payment_transactions')
        .where('company_id', '==', userData.companyId)
        .where('provider', '==', 'stripe')
        .limit(1)
        .get()
      customerId = transactionSnap.empty ? null : transactionSnap.docs[0].data().customer_id || null
    }

    if (!customerId) {
      return NextResponse.json({ error: 'stripe-customer-not-found' }, { status: 404 })
    }

    const stripeResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: toFormBody({
        customer: customerId,
        return_url: `${origin}/dashboard/verified-plan`,
      }),
    })

    const stripeData = await stripeResponse.json()
    if (!stripeResponse.ok) {
      return NextResponse.json({ error: stripeData?.error?.message || 'stripe-portal-failed' }, { status: 500 })
    }

    return NextResponse.json({ url: stripeData.url })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'verified-plan-portal-failed' }, { status: 500 })
  }
}
