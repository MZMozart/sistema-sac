import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/server-auth'

function mapEmployeeError(error: any) {
  const code = String(error?.code || '')
  const message = String(error?.message || '')

  if (code.includes('EMAIL_EXISTS') || code.includes('email-already-exists')) {
    return 'Já existe outra conta usando este e-mail.'
  }

  if (code.includes('WEAK_PASSWORD')) {
    return 'A senha temporária precisa ser mais forte.'
  }

  return message || 'employee-account-failed'
}

export async function POST(request: NextRequest) {
  try {
    const { userData } = await getServerUser(request)
    if (!userData?.companyId || !['owner', 'manager'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { email, phone, temporaryPassword } = body

    if (!email || !temporaryPassword) {
      return NextResponse.json({ error: 'invalid-payload' }, { status: 400 })
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'firebase-api-key-missing' }, { status: 500 })
    }

    const firebaseResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: temporaryPassword,
        returnSecureToken: true,
      }),
    })

    const firebaseData = await firebaseResponse.json()
    if (!firebaseResponse.ok) {
      throw { code: firebaseData?.error?.message || 'employee-account-failed' }
    }

    return NextResponse.json({ uid: firebaseData.localId, phone: phone || '' })
  } catch (error: any) {
    return NextResponse.json({ error: mapEmployeeError(error) }, { status: 500 })
  }
}