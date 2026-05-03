import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, adminStorage } from '@/lib/firebase-admin'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const companyId = String(formData.get('companyId') || '')
    const callId = String(formData.get('callId') || '')
    const protocol = String(formData.get('protocol') || callId)

    if (!(file instanceof File) || !companyId || !callId) {
      return NextResponse.json({ error: 'missing-recording-data' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const bucket = adminStorage.bucket()
    const path = `calls/${companyId}/${callId}/recording-${Date.now()}.webm`
    const destination = bucket.file(path)

    await destination.save(buffer, {
      contentType: file.type || 'audio/webm',
      resumable: false,
      metadata: {
        cacheControl: 'private, max-age=31536000',
      },
    })

    const [signedUrl] = await destination.getSignedUrl({
      action: 'read',
      expires: '2035-01-01',
    })
    const recordingUrl = signedUrl || `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(path).replace(/%2F/g, '/')}`

    await adminDb.collection('calls').doc(callId).set({
      recordingRequired: true,
      recordingStatus: 'saved',
      recordingUrl,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })

    await adminDb.collection('audit_logs').add({
      companyId,
      protocol,
      callId,
      channel: 'call',
      eventType: 'call_recording_saved',
      summary: 'Gravação da ligação salva com sucesso.',
      metadata: { recordingUrl },
      createdAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ recordingUrl })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'recording-upload-failed' }, { status: 500 })
  }
}
