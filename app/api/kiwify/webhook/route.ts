import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

const ACTIVE_EVENTS = ['compra_aprovada', 'subscription_renewed']
const INACTIVE_EVENTS = ['compra_reembolsada', 'chargeback', 'subscription_canceled', 'subscription_late']

function findValue(source: any, keys: string[]): string | null {
  const normalized = keys.map((key) => key.toLowerCase())
  const seen = new Set<any>()

  function visit(value: any): string | null {
    if (!value || typeof value !== 'object' || seen.has(value)) return null
    seen.add(value)

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item)
        if (found) return found
      }
      return null
    }

    for (const [key, item] of Object.entries(value)) {
      if (normalized.includes(key.toLowerCase()) && item != null) {
        return String(item)
      }
    }

    for (const item of Object.values(value)) {
      const found = visit(item)
      if (found) return found
    }

    return null
  }

  return visit(source)
}

function collectStrings(source: any): string[] {
  const values: string[] = []
  const seen = new Set<any>()

  function visit(value: any) {
    if (typeof value === 'string') {
      values.push(value.toLowerCase())
      return
    }

    if (!value || typeof value !== 'object' || seen.has(value)) return
    seen.add(value)

    Object.values(value).forEach(visit)
  }

  visit(source)
  return values
}

function getBearerToken(value: string | null) {
  if (!value) return null
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : value.trim()
}

async function updateCompanyVerification(companyId: string, active: boolean, extras: Record<string, any> = {}) {
  await adminDb.collection('companies').doc(companyId).set({
    premiumVerificationActive: active,
    premiumVerificationProvider: 'kiwify',
    premiumVerificationUpdatedAt: new Date().toISOString(),
    ...extras,
  }, { merge: true })
}

export async function POST(request: NextRequest) {
  try {
    const expectedToken = process.env.KIWIFY_WEBHOOK_TOKEN
    if (!expectedToken) {
      return NextResponse.json({ error: 'kiwify-webhook-token-missing' }, { status: 500 })
    }

    const payload = await request.json()
    const providedToken =
      request.nextUrl.searchParams.get('token') ||
      request.headers.get('x-kiwify-token') ||
      getBearerToken(request.headers.get('authorization')) ||
      findValue(payload, ['token', 'webhook_token'])

    if (providedToken !== expectedToken) {
      return NextResponse.json({ error: 'invalid-token' }, { status: 401 })
    }

    const companyId = findValue(payload, ['companyId', 'company_id', 's1'])
    if (!companyId) {
      return NextResponse.json({ error: 'company-id-missing' }, { status: 400 })
    }

    const values = collectStrings(payload)
    const eventType = findValue(payload, ['event', 'event_type', 'webhook_event_type', 'type', 'status']) || 'unknown'
    const eventValues = values.filter((value) => ACTIVE_EVENTS.includes(value) || INACTIVE_EVENTS.includes(value))
    const shouldActivate = eventValues.some((value) => ACTIVE_EVENTS.includes(value))
    const shouldDeactivate = eventValues.some((value) => INACTIVE_EVENTS.includes(value))
    const transactionId = findValue(payload, ['order_id', 'sale_id', 'purchase_id', 'transaction_id', 'id'])
    const subscriptionId = findValue(payload, ['subscription_id', 'subscriptionId'])
    const customerEmail = findValue(payload, ['email', 'customer_email'])

    await adminDb.collection('payment_transactions').add({
      company_id: companyId,
      provider: 'kiwify',
      type: 'webhook',
      plan_slug: 'verified_monthly',
      status: shouldActivate ? 'active' : shouldDeactivate ? 'inactive' : 'received',
      payment_status: shouldActivate ? 'paid' : shouldDeactivate ? 'inactive' : 'received',
      provider_event_type: eventType,
      provider_event_values: eventValues,
      provider_transaction_id: transactionId,
      subscription_id: subscriptionId,
      customer_email: customerEmail,
      created_at: new Date().toISOString(),
      metadata: payload,
    })

    if (shouldActivate) {
      await updateCompanyVerification(companyId, true, {
        premiumVerificationStatus: 'active',
        premiumVerificationPlan: 'verified_monthly',
        premiumVerificationAmount: 49,
        premiumVerificationSubscriptionId: subscriptionId,
        premiumVerificationCustomerId: customerEmail,
      })
    }

    if (shouldDeactivate) {
      await updateCompanyVerification(companyId, false, {
        premiumVerificationStatus: eventValues.includes('subscription_late') ? 'delinquent' : 'canceled',
      })
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'kiwify-webhook-failed' }, { status: 500 })
  }
}
