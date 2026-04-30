import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

function parseSignature(header: string | null) {
  if (!header) return null
  const entries = Object.fromEntries(
    header.split(',').map((chunk) => {
      const [key, value] = chunk.split('=')
      return [key, value]
    })
  )
  return { timestamp: entries.t, signature: entries.v1 }
}

function verifyStripeSignature(payload: string, header: string | null, secret: string) {
  const parsed = parseSignature(header)
  if (!parsed?.timestamp || !parsed.signature) return false

  const signedPayload = `${parsed.timestamp}.${payload}`
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parsed.signature))
}

async function updateCompanyVerification(companyId: string, active: boolean, extras: Record<string, any> = {}) {
  await adminDb.collection('companies').doc(companyId).set({
    premiumVerificationActive: active,
    ...extras,
  }, { merge: true })
}

async function findTransaction(sessionId: string | null, subscriptionId: string | null, customerId: string | null) {
  if (sessionId) {
    const bySession = await adminDb.collection('payment_transactions').where('session_id', '==', sessionId).limit(1).get()
    if (!bySession.empty) return bySession.docs[0]
  }

  if (subscriptionId) {
    const bySubscription = await adminDb.collection('payment_transactions').where('subscription_id', '==', subscriptionId).limit(1).get()
    if (!bySubscription.empty) return bySubscription.docs[0]
  }

  if (customerId) {
    const byCustomer = await adminDb.collection('payment_transactions').where('customer_id', '==', customerId).limit(1).get()
    if (!byCustomer.empty) return byCustomer.docs[0]
  }

  return null
}

async function resolveCompanyId(explicitCompanyId: string | null, subscriptionId: string | null, customerId: string | null, transactionCompanyId: string | null) {
  if (explicitCompanyId) return explicitCompanyId
  if (transactionCompanyId) return transactionCompanyId

  if (subscriptionId) {
    const companyBySubscription = await adminDb.collection('companies').where('premiumVerificationSubscriptionId', '==', subscriptionId).limit(1).get()
    if (!companyBySubscription.empty) return companyBySubscription.docs[0].id
  }

  if (customerId) {
    const companyByCustomer = await adminDb.collection('companies').where('premiumVerificationCustomerId', '==', customerId).limit(1).get()
    if (!companyByCustomer.empty) return companyByCustomer.docs[0].id
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      return NextResponse.json({ error: 'stripe-webhook-secret-missing' }, { status: 500 })
    }

    const rawBody = await request.text()
    const signatureHeader = request.headers.get('stripe-signature')
    const valid = verifyStripeSignature(rawBody, signatureHeader, webhookSecret)

    if (!valid) {
      return NextResponse.json({ error: 'invalid-signature' }, { status: 400 })
    }

    const event = JSON.parse(rawBody)
    const eventType = event?.type || ''
    const data = event?.data?.object || {}
    const sessionId = data.id || data.checkout_session || data.session || null
    const subscriptionId = data.subscription || (eventType === 'customer.subscription.deleted' ? data.id : null) || null
    const customerId = data.customer || null

    const transactionDoc = await findTransaction(sessionId, subscriptionId, customerId)
    const transactionRef = transactionDoc?.ref || null
    const transactionData = transactionDoc?.data() || null
    const companyId = await resolveCompanyId(
      data.metadata?.companyId || data.metadata?.company_id || null,
      subscriptionId,
      customerId,
      transactionData?.company_id || null,
    )

    if (transactionRef) {
      await transactionRef.set({
        last_event_type: eventType,
        provider_event_id: event.id,
        subscription_id: subscriptionId,
        customer_id: customerId,
        updated_at: new Date().toISOString(),
      }, { merge: true })
    }

    if (eventType === 'checkout.session.completed') {
      if (transactionRef) {
        await transactionRef.set({
          status: 'active',
          payment_status: data.payment_status || 'paid',
          subscription_id: subscriptionId,
          customer_id: customerId,
        }, { merge: true })
      }

      if (companyId) {
        await updateCompanyVerification(companyId, true, {
          premiumVerificationPlan: 'verified_monthly',
          premiumVerificationAmount: 49,
          premiumVerificationUpdatedAt: new Date().toISOString(),
          premiumVerificationStatus: 'active',
          premiumVerificationSubscriptionId: subscriptionId,
          premiumVerificationCustomerId: customerId,
        })
      }
    }

    if (eventType === 'invoice.payment_failed') {
      if (transactionRef) {
        await transactionRef.set({
          status: 'delinquent',
          payment_status: 'failed',
        }, { merge: true })
      }

      if (companyId) {
        await updateCompanyVerification(companyId, false, {
          premiumVerificationStatus: 'delinquent',
          premiumVerificationUpdatedAt: new Date().toISOString(),
        })
      }
    }

    if (eventType === 'customer.subscription.deleted') {
      if (transactionRef) {
        await transactionRef.set({
          status: 'canceled',
          payment_status: 'canceled',
        }, { merge: true })
      }

      if (companyId) {
        await updateCompanyVerification(companyId, false, {
          premiumVerificationStatus: 'canceled',
          premiumVerificationUpdatedAt: new Date().toISOString(),
        })
      }
    }

    if (eventType === 'invoice.paid') {
      if (transactionRef) {
        await transactionRef.set({
          status: 'active',
          payment_status: 'paid',
          last_paid_at: new Date().toISOString(),
        }, { merge: true })
      }

      if (companyId) {
        await updateCompanyVerification(companyId, true, {
          premiumVerificationStatus: 'active',
          premiumVerificationUpdatedAt: new Date().toISOString(),
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'stripe-webhook-failed' }, { status: 500 })
  }
}