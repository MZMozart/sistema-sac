import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { getServerUser } from '@/lib/server-auth'

function isAuthUserMissing(error: any) {
  const message = String(error?.message || error?.code || '')
  return message.includes('user-not-found') || message.includes('auth/user-not-found')
}

async function safeDeleteAuthUser(userId: string) {
  try {
    await adminAuth.deleteUser(userId)
  } catch (error) {
    if (!isAuthUserMissing(error)) {
      throw error
    }
  }
}

async function commitDeleteRefs(refs: FirebaseFirestore.DocumentReference[]) {
  for (let index = 0; index < refs.length; index += 400) {
    const batch = adminDb.batch()
    refs.slice(index, index + 400).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
}

async function commitSetOperations(operations: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, any>; merge?: boolean }>) {
  for (let index = 0; index < operations.length; index += 250) {
    const batch = adminDb.batch()
    operations.slice(index, index + 250).forEach(({ ref, data, merge }) => batch.set(ref, data, { merge: Boolean(merge) }))
    await batch.commit()
  }
}

async function deleteQueryDocs(query: FirebaseFirestore.Query) {
  const snapshot = await query.get()
  await commitDeleteRefs(snapshot.docs.map((doc) => doc.ref))
}

export async function DELETE(request: NextRequest) {
  try {
    const { uid, userData } = await getServerUser(request)
    const body = await request.json().catch(() => ({}))

    if (body?.confirmation !== 'APAGAR') {
      return NextResponse.json({ error: 'invalid-confirmation' }, { status: 400 })
    }

    const baseLog = {
      actorUserId: uid,
      createdAt: new Date().toISOString(),
    }

    if (userData?.accountType === 'pj' && userData.companyId && (userData.role || 'owner') === 'owner') {
      const companyId = userData.companyId
      const employeesSnap = await adminDb.collection('employees').where('companyId', '==', companyId).get()
      const userDocsSnap = await adminDb.collection('users').where('companyId', '==', companyId).get()
      const companyUserIds = Array.from(new Set([
        uid,
        ...employeesSnap.docs.map((doc) => String(doc.data().userId || '')).filter(Boolean),
        ...userDocsSnap.docs.map((doc) => doc.id),
      ]))

      await Promise.all([
        deleteQueryDocs(adminDb.collection('messages').where('companyId', '==', companyId)),
        deleteQueryDocs(adminDb.collection('chats').where('companyId', '==', companyId)),
        deleteQueryDocs(adminDb.collection('calls').where('companyId', '==', companyId)),
        deleteQueryDocs(adminDb.collection('ratings').where('companyId', '==', companyId)),
        deleteQueryDocs(adminDb.collection('notifications').where('recipientCompanyId', '==', companyId)),
        deleteQueryDocs(adminDb.collection('logs').where('companyId', '==', companyId)),
        deleteQueryDocs(adminDb.collection('payment_transactions').where('company_id', '==', companyId)),
      ])

      await commitDeleteRefs([
        ...employeesSnap.docs.map((doc) => doc.ref),
        ...userDocsSnap.docs.map((doc) => doc.ref),
        adminDb.collection('companies').doc(companyId),
      ])

      await adminDb.collection('logs').add({
        ...baseLog,
        companyId,
        action: 'owner_account_deleted',
        details: { scope: 'company' },
      })

      await Promise.all(companyUserIds.map((userId) => safeDeleteAuthUser(userId)))
      return NextResponse.json({ ok: true, scope: 'company' })
    }

    const deleteRefs: FirebaseFirestore.DocumentReference[] = [adminDb.collection('users').doc(uid)]

    const employeeDocsSnap = await adminDb.collection('employees').where('userId', '==', uid).get()
    deleteRefs.push(...employeeDocsSnap.docs.map((doc) => doc.ref))

    const notificationsSnap = await adminDb.collection('notifications').where('recipientUserId', '==', uid).get()
    deleteRefs.push(...notificationsSnap.docs.map((doc) => doc.ref))

    if (userData?.accountType === 'pf' || userData?.role === 'client') {
      const chatsSnap = await adminDb.collection('chats').where('clientId', '==', uid).get()
      const callsSnap = await adminDb.collection('calls').where('clientId', '==', uid).get()
      const ratingsSnap = await adminDb.collection('ratings').where('clientId', '==', uid).get()

      await commitSetOperations([
        ...chatsSnap.docs.map((doc) => ({
          ref: doc.ref,
          data: {
            clientId: `deleted:${uid}`,
            clientName: 'Cliente removido',
            clientEmail: null,
            updatedAt: new Date().toISOString(),
          },
          merge: true,
        })),
        ...callsSnap.docs.map((doc) => ({
          ref: doc.ref,
          data: {
            clientId: `deleted:${uid}`,
            clientName: 'Cliente removido',
            updatedAt: new Date().toISOString(),
          },
          merge: true,
        })),
        ...ratingsSnap.docs.map((doc) => ({
          ref: doc.ref,
          data: {
            clientId: `deleted:${uid}`,
            updatedAt: new Date().toISOString(),
          },
          merge: true,
        })),
      ])
    } else {
      const chatsSnap = await adminDb.collection('chats').where('employeeId', '==', uid).get()
      const callsSnap = await adminDb.collection('calls').where('employeeId', '==', uid).get()

      await commitSetOperations([
        ...chatsSnap.docs.map((doc) => ({
          ref: doc.ref,
          data: {
            employeeId: null,
            employeeName: 'Conta removida',
            updatedAt: new Date().toISOString(),
          },
          merge: true,
        })),
        ...callsSnap.docs.map((doc) => ({
          ref: doc.ref,
          data: {
            employeeId: null,
            employeeName: 'Conta removida',
            updatedAt: new Date().toISOString(),
          },
          merge: true,
        })),
      ])
    }

    await commitDeleteRefs(deleteRefs)

    await adminDb.collection('logs').add({
      ...baseLog,
      companyId: userData?.companyId || null,
      action: 'user_account_deleted',
      details: { scope: userData?.accountType === 'pf' ? 'client' : 'employee' },
    })

    await safeDeleteAuthUser(uid)
    return NextResponse.json({ ok: true, scope: userData?.accountType === 'pf' ? 'client' : 'employee' })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'account-delete-failed' }, { status: 500 })
  }
}