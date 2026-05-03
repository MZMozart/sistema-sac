import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import fs from 'fs'
import path from 'path'

function normalizePrivateKey(value?: string) {
  return value?.replace(/\\n/g, '\n')
}

function normalizeCredentialEnv(value: string) {
  const trimmed = value.trim()
  const first = trimmed[0]
  const last = trimmed[trimmed.length - 1]

  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

function parseServiceAccount(raw: string): ServiceAccount {
  const parsed = JSON.parse(normalizeCredentialEnv(raw))
  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: normalizePrivateKey(parsed.private_key),
  }
}

function getServiceAccount(): ServiceAccount | null {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const raw = normalizeCredentialEnv(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
    try {
      return parseServiceAccount(decoded)
    } catch (error) {
      console.error('Não foi possível carregar a credencial Firebase Admin da variável FIREBASE_SERVICE_ACCOUNT_JSON.')
      return null
    }
  }

  if (
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ) {
    return {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
    }
  }

  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(process.cwd(), 'secure', 'firebase-admin.json'),
    '/app/secure/firebase-admin.json',
  ].filter(Boolean) as string[]

  const credentialsPath = candidates.find((candidate) => fs.existsSync(candidate))
  if (!credentialsPath) return null

  return parseServiceAccount(fs.readFileSync(credentialsPath, 'utf8'))
}

const serviceAccount = getServiceAccount()
const projectId = (serviceAccount as any)?.projectId || process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || (projectId ? `${projectId}.appspot.com` : undefined)

const adminApp = getApps().length
  ? getApps()[0]
  : initializeApp(
      serviceAccount
        ? { credential: cert(serviceAccount), storageBucket }
        : { projectId, storageBucket }
    )

export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)
export const adminStorage = getStorage(adminApp)
