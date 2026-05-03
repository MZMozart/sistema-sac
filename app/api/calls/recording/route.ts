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
    const bucketNames = Array.from(new Set([
      process.env.FIREBASE_STORAGE_BUCKET,
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com` : null,
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app` : null,
    ].filter(Boolean) as string[]))
    const path = `calls/${companyId}/${callId}/recording-${Date.now()}.webm`
    let bucket = bucketNames.length > 0 ? adminStorage.bucket(bucketNames[0]) : adminStorage.bucket()
    let destination = bucket.file(path)
    let lastUploadError: any = null

    for (const bucketName of bucketNames.length > 0 ? bucketNames : [undefined]) {
      bucket = bucketName ? adminStorage.bucket(bucketName) : adminStorage.bucket()
      destination = bucket.file(path)
      try {
        await destination.save(buffer, {
          contentType: file.type || 'audio/webm',
          resumable: false,
          metadata: {
            cacheControl: 'private, max-age=31536000',
          },
        })
        lastUploadError = null
        break
      } catch (uploadError: any) {
        lastUploadError = uploadError
      }
    }

    if (lastUploadError) throw lastUploadError

    const [signedUrl] = await destination.getSignedUrl({
      action: 'read',
      expires: '2035-01-01',
    })
    const recordingUrl = signedUrl || `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(path).replace(/%2F/g, '/')}`

    try {
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
    } catch (metadataError: any) {
      console.error('Gravação enviada, mas não foi possível registrar no Firestore:', metadataError?.message || metadataError)
    }

    return NextResponse.json({ recordingUrl })
  } catch (error: any) {
    console.error('Falha ao salvar gravação da ligação:', error?.message || error)
    return NextResponse.json({ error: error?.message || 'recording-upload-failed' }, { status: 500 })
  }
}
