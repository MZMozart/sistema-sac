import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { getServerUser } from '@/lib/server-auth'

export async function GET(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const stripeApiKey = process.env.STRIPE_API_KEY
    if (!stripeApiKey) {
      return NextResponse.json({ error: 'stripe-key-missing' }, { status: 500 })
    }

    const { userData } = await getServerUser(request)
    if (!userData?.companyId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${params.sessionId}`, {
      headers: { Authorization: `Bearer ${stripeApiKey}` },
      cache: 'no-store',
    })
    const stripeData = await stripeResponse.json()
    if (!stripeResponse.ok) {
      return NextResponse.json({ error: stripeData?.error?.message || 'stripe-status-failed' }, { status: 500 })
    }

    const transactionSnap = await adminDb.collection('payment_transactions').where('session_id', '==', params.sessionId).limit(1).get()
    if (!transactionSnap.empty) {
      const transactionRef = transactionSnap.docs[0].ref
      await transactionRef.update({
        status: stripeData.status || 'open',
        payment_status: stripeData.payment_status || 'unpaid',
        subscription_id: stripeData.subscription || null,
        customer_id: stripeData.customer || null,
        updated_at: new Date().toISOString(),
      })
    }

    const isPaid = stripeData.status === 'complete' || stripeData.payment_status === 'paid'
    if (isPaid && stripeData.metadata?.companyId) {
      await adminDb.collection('companies').doc(stripeData.metadata.companyId).set({
        premiumVerificationActive: true,
        premiumVerificationStatus: 'active',
        premiumVerificationPlan: 'verified_monthly',
        premiumVerificationAmount: 49,
        premiumVerificationSubscriptionId: stripeData.subscription || null,
        premiumVerificationCustomerId: stripeData.customer || null,
        premiumVerificationUpdatedAt: new Date().toISOString(),
      }, { merge: true })
    }

    return NextResponse.json({
      status: stripeData.status,
      paymentStatus: stripeData.payment_status,
      paid: isPaid,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'verified-plan-status-failed' }, { status: 500 })
  }
}
