import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { getServerUser } from '@/lib/server-auth'

function isMissingAuthUser(error: any) {
  const message = String(error?.message || error?.code || '')
  return message.includes('user-not-found') || message.includes('auth/user-not-found')
}

async function safeDisableUser(userId: string, disabled: boolean) {
  try {
    await adminAuth.updateUser(userId, { disabled })
  } catch (error) {
    if (!isMissingAuthUser(error)) {
      throw error
    }
  }
}

async function safeDeleteAuthUser(userId: string) {
  try {
    await adminAuth.deleteUser(userId)
  } catch (error) {
    if (!isMissingAuthUser(error)) {
      throw error
    }
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { employeeId: string } }) {
  try {
    const { uid, userData } = await getServerUser(request)
    if (!userData?.companyId || !['owner', 'manager'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const employeeRef = adminDb.collection('employees').doc(params.employeeId)
    const employeeSnap = await employeeRef.get()

    if (!employeeSnap.exists) {
      return NextResponse.json({ error: 'employee-not-found' }, { status: 404 })
    }

    const employeeData = employeeSnap.data()
    if (employeeData?.companyId !== userData.companyId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    await employeeRef.update({
      name: body.name ?? employeeData?.name,
      phone: body.phone ?? employeeData?.phone,
      role: body.role ?? employeeData?.role,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : employeeData?.isActive,
      permissions: body.permissions ?? employeeData?.permissions,
      workSchedule: body.workSchedule ?? employeeData?.workSchedule,
      tempAccessApprovedUntil: body.tempAccessApprovedUntil ?? employeeData?.tempAccessApprovedUntil ?? null,
      updatedAt: new Date().toISOString(),
    })

    if (employeeData?.userId) {
      await adminDb.collection('users').doc(employeeData.userId).set({
        name: body.name ?? employeeData?.name,
        fullName: body.name ?? employeeData?.name,
        phone: body.phone ?? employeeData?.phone,
        role: body.role ?? employeeData?.role,
      }, { merge: true })

      if (typeof body.isActive === 'boolean') {
        await safeDisableUser(employeeData.userId, !body.isActive)
      }
    }

    await adminDb.collection('logs').add({
      companyId: userData.companyId,
      employeeId: params.employeeId,
      actorUserId: uid,
      action: 'employee_updated',
      details: body,
      createdAt: new Date().toISOString(),
    })

    await adminDb.collection('notifications').add({
      recipientCompanyId: userData.companyId,
      recipientUserId: employeeData?.userId,
      title: 'Dados de funcionário atualizados',
      body: `${body.name ?? employeeData?.name} teve suas informações ou permissões ajustadas.`,
      type: 'system',
      actionUrl: '/dashboard/employees',
      entityId: params.employeeId,
      entityType: 'profile',
      actorName: body.name ?? employeeData?.name,
      readAt: null,
      createdAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'employee-update-failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { employeeId: string } }) {
  try {
    const { uid, userData } = await getServerUser(request)
    if (!userData?.companyId || !['owner', 'manager'].includes(userData?.role || '')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const employeeRef = adminDb.collection('employees').doc(params.employeeId)
    const employeeSnap = await employeeRef.get()
    if (!employeeSnap.exists) {
      return NextResponse.json({ error: 'employee-not-found' }, { status: 404 })
    }

    const employeeData = employeeSnap.data()
    if (employeeData?.companyId !== userData.companyId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    if (employeeData?.role === 'owner') {
      return NextResponse.json({ error: 'owner-delete-not-allowed' }, { status: 400 })
    }

    if (employeeData?.userId === uid) {
      return NextResponse.json({ error: 'self-delete-not-allowed' }, { status: 400 })
    }

    const batch = adminDb.batch()
    batch.delete(employeeRef)
    if (employeeData?.userId) {
      batch.delete(adminDb.collection('users').doc(employeeData.userId))
    }

    const logRef = adminDb.collection('logs').doc()
    batch.set(logRef, {
      companyId: userData.companyId,
      employeeId: params.employeeId,
      actorUserId: uid,
      action: 'employee_deleted',
      details: { userId: employeeData?.userId, email: employeeData?.email || null },
      createdAt: new Date().toISOString(),
    })

    const notificationRef = adminDb.collection('notifications').doc()
    batch.set(notificationRef, {
      recipientCompanyId: userData.companyId,
      title: 'Funcionário removido da operação',
      body: `${employeeData?.name || 'Funcionário'} foi removido do quadro ativo.`,
      type: 'system',
      actionUrl: '/dashboard/employees',
      entityId: params.employeeId,
      entityType: 'profile',
      actorName: employeeData?.name,
      readAt: null,
      createdAt: new Date().toISOString(),
    })

    await batch.commit()

    if (employeeData?.userId) {
      await safeDeleteAuthUser(employeeData.userId)
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'employee-delete-failed' }, { status: 500 })
  }
}