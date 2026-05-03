import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const publicFirebaseEnv = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export const firebaseEnvReady = Object.values(publicFirebaseEnv).every(Boolean)

function getRuntimeAuthDomain() {
  if (typeof window === 'undefined') return publicFirebaseEnv.authDomain
  return window.location.hostname === 'atendepro-tcc.vercel.app'
    ? window.location.hostname
    : publicFirebaseEnv.authDomain
}

export const firebaseConfig = {
  apiKey: publicFirebaseEnv.apiKey || 'missing-api-key',
  authDomain: getRuntimeAuthDomain() || 'missing.firebaseapp.com',
  projectId: publicFirebaseEnv.projectId || 'missing-project-id',
  storageBucket: publicFirebaseEnv.storageBucket || (publicFirebaseEnv.projectId ? `${publicFirebaseEnv.projectId}.appspot.com` : 'missing-project-id.appspot.com'),
  messagingSenderId: publicFirebaseEnv.messagingSenderId || '0',
  appId: publicFirebaseEnv.appId || 'missing-app-id',
}

if (!firebaseEnvReady && typeof window !== 'undefined') {
  console.warn('Missing Firebase public environment variables. Configure .env.local or Vercel Environment Variables.')
}

// Initialize Firebase
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()
export const appleProvider = new OAuthProvider('apple.com')

// Configure Google provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
})

// Configure Apple provider
appleProvider.addScope('email')
appleProvider.addScope('name')

export default app
