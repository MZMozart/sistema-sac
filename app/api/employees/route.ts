import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { getServerUser } from '@/lib/server-auth'

function normalizeE164(phone?: string) {
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, '')
  if (!digits) return undefined
  const normalized = phone.trim().startsWith('+') ? `+${digits}` : `+${digits}`
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : undefined
}

function mapEmployeeError(error: any) {
  const code = String(error?.code || '')
  const message = String(error?.message || '')

  if (code.includes('phone-number-already-exists') || message.includes('phone number already exists')) {
    return 'Já existe outra conta usando este telefone. Use outro número ou deixe o campo telefone em branco.'
  }

  if (code.includes('email-already-exists')) {
    return 'Já existe outra conta usando este e-mail.'
  }

  if (code.includes('invalid-phone-number')) {
    return 'Telefone inválido. Use outro número ou deixe o campo telefone em branco.'
  }

  return message || 'employee-create-failed'
}

export async function GET(request: NextRequest) {
  try {
    const { userData } = await getServerUser(request)
    const companyId = userData?.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'company-not-found' }, { status: 400 })
    }

    const snapshot = await adminDb.collection('employees').where('companyId', '==', companyId).get()
    const employees = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    return NextResponse.json({ employees })
  } catch (error) {
    return NextResponse.json({ error: 'employees-load-failed' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { uid, userData } = await getServerUser(request)
    if (!userData?.companyId || !['owner', 'manager'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, email, phone, role, temporaryPassword, permissions, workSchedule } = body

    if (!name || !email || !role || !temporaryPassword) {
      return NextResponse.json({ error: 'invalid-payload' }, { status: 400 })
    }

    const normalizedPhone = normalizeE164(phone)

    const createdUser = await adminAuth.createUser({
      email,
      password: temporaryPassword,
      displayName: name,
      phoneNumber: normalizedPhone,
    })

    const companyId = userData.companyId
    const employeeId = `${companyId}_${createdUser.uid}`
    const now = new Date().toISOString()

    await adminDb.collection('users').doc(createdUser.uid).set({
      uid: createdUser.uid,
      name,
      fullName: name,
      email,
      phone: normalizedPhone || phone || '',
      accountType: 'pj',
      role,
      companyId,
      createdAt: now,
      emailVerified: false,
      phoneVerified: false,
      createdBy: uid,
      isEmployeeAccount: true,
    })

    await adminDb.collection('employees').doc(employeeId).set({
      id: employeeId,
      companyId,
      userId: createdUser.uid,
      ownerId: uid,
      name,
      email,
      phone: normalizedPhone || phone || '',
      role,
      isActive: true,
      permissions: {
        canViewDashboard: role !== 'employee',
        canManageEmployees: role === 'owner' || role === 'manager',
        canEditCompanySettings: role === 'owner' || role === 'manager',
        canViewAllChats: true,
        canViewAllCalls: true,
        canExportData: role !== 'employee',
        canDeleteCompany: role === 'owner',
        canEditBotPolicies: role !== 'employee',
        canManagePermissions: role === 'owner',
        canViewRatings: role !== 'employee',
        canManageIntegrations: role !== 'employee',
        ...(permissions || {}),
      },
      workSchedule: workSchedule || { enabled: true, days: [1, 2, 3, 4, 5], start: '08:00', end: '18:00' },
      tempAccessApprovedUntil: null,
      createdAt: now,
      totalChats: 0,
      totalCalls: 0,
      averageRating: 0,
      totalRatings: 0,
      inactivityCount: 0,
    })

    await adminDb.collection('logs').add({
      companyId,
      employeeId,
      actorUserId: uid,
      action: 'employee_created',
      details: { name, email, role, permissions: permissions || null, workSchedule: workSchedule || null },
      createdAt: now,
    })

    await adminDb.collection('notifications').add({
      recipientCompanyId: companyId,
      recipientUserId: createdUser.uid,
      title: 'Novo funcionário cadastrado',
      body: `${name} foi adicionado à operação com o papel ${role}.`,
      type: 'system',
      actionUrl: '/dashboard/employees',
      entityId: employeeId,
      entityType: 'profile',
      actorName: name,
      readAt: null,
      createdAt: now,
    })

    return NextResponse.json({
      employee: {
        id: employeeId,
        userId: createdUser.uid,
        name,
        email,
        phone: normalizedPhone || phone || '',
        role,
        isActive: true,
        permissions: {
          canViewDashboard: role !== 'employee',
          canManageEmployees: role === 'owner' || role === 'manager',
          canEditCompanySettings: role === 'owner' || role === 'manager',
          canViewAllChats: true,
          canViewAllCalls: true,
          canExportData: role !== 'employee',
          canDeleteCompany: role === 'owner',
          canEditBotPolicies: role !== 'employee',
          canManagePermissions: role === 'owner',
          canViewRatings: role !== 'employee',
          canManageIntegrations: role !== 'employee',
          ...(permissions || {}),
        },
        workSchedule: workSchedule || { enabled: true, days: [1, 2, 3, 4, 5], start: '08:00', end: '18:00' },
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: mapEmployeeError(error) }, { status: 500 })
  }
}