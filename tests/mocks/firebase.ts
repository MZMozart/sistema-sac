import { vi } from 'vitest'

type StoredDoc = {
  id: string
  data: Record<string, any>
}

type CollectionSeed = Record<string, Array<StoredDoc | Record<string, any>>>

type DocRef = {
  type: 'doc'
  collectionPath: string
  id: string
}

type CollectionRef = {
  type: 'collection'
  path: string
}

type QueryRef = {
  type: 'query'
  collectionPath: string
  constraints: Array<Record<string, any>>
}

const state = {
  collections: new Map<string, StoredDoc[]>(),
  operations: {
    addDoc: [] as Array<{ collectionPath: string; data: Record<string, any> }>,
    setDoc: [] as Array<{ collectionPath: string; id: string; data: Record<string, any> }>,
    updateDoc: [] as Array<{ collectionPath: string; id: string; data: Record<string, any> }>,
  },
  failures: new Map<string, Error>(),
  idCounter: 1,
  authUser: null as any,
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function normalizeDoc(item: StoredDoc | Record<string, any>, index: number): StoredDoc {
  if ('id' in item && 'data' in item) {
    return { id: String(item.id), data: clone((item as StoredDoc).data) }
  }

  const raw = item as Record<string, any>
  const id = String(raw.id || `doc-${index + 1}`)
  const { id: _id, ...data } = raw
  return { id, data: clone(data) }
}

function takeFailure(name: string) {
  const failure = state.failures.get(name)
  if (failure) {
    state.failures.delete(name)
    throw failure
  }
}

function getCollection(path: string) {
  if (!state.collections.has(path)) {
    state.collections.set(path, [])
  }
  return state.collections.get(path)!
}

function applyConstraints(rows: StoredDoc[], constraints: Array<Record<string, any>>) {
  let result = rows
  for (const constraint of constraints) {
    if (constraint.type === 'where' && constraint.op === '==') {
      result = result.filter((row) => row.data[constraint.field] === constraint.value)
    }
    if (constraint.type === 'limit') {
      result = result.slice(0, constraint.count)
    }
  }
  return result
}

export function resetFirebaseMocks(seed: CollectionSeed = {}) {
  state.collections.clear()
  Object.values(state.operations).forEach((items) => items.splice(0))
  state.failures.clear()
  state.idCounter = 1
  state.authUser = null
  auth.currentUser = null

  for (const [collectionPath, docs] of Object.entries(seed)) {
    state.collections.set(collectionPath, docs.map(normalizeDoc))
  }

  Object.values(authMocks).forEach((mock) => mock.mockReset())
  firestore.serverTimestamp.mockReturnValue({ __type: 'serverTimestamp' })
}

export function failNextFirebaseCall(name: string, error = new Error(`${name}-failed`)) {
  state.failures.set(name, error)
}

export function getMockCollection(collectionPath: string) {
  return getCollection(collectionPath).map((item) => ({ id: item.id, ...clone(item.data) }))
}

export function getFirebaseOperations() {
  return state.operations
}

export const db = { __name: 'mock-firestore' }

export const auth = {
  currentUser: null as any,
}

export const googleProvider = {
  setCustomParameters: vi.fn(),
}

export const appleProvider = {
  addScope: vi.fn(),
}

export const appFirebase = {
  app: { name: 'mock-app' },
  auth,
  db,
  storage: {},
  googleProvider,
  appleProvider,
  firebaseConfig: {
    apiKey: 'test',
    authDomain: 'test.firebaseapp.com',
    projectId: 'test',
    storageBucket: 'test.appspot.com',
    messagingSenderId: '1',
    appId: '1:test:web:test',
  },
  default: { name: 'mock-app' },
}

export const firestore = {
  collection: vi.fn((_db: unknown, collectionPath: string): CollectionRef => ({
    type: 'collection',
    path: collectionPath,
  })),
  doc: vi.fn((first: any, collectionPathOrId?: string, id?: string): DocRef => {
    if (first?.type === 'collection') {
      return {
        type: 'doc',
        collectionPath: first.path,
        id: collectionPathOrId || `generated-${state.idCounter++}`,
      }
    }

    return {
      type: 'doc',
      collectionPath: String(collectionPathOrId),
      id: String(id),
    }
  }),
  where: vi.fn((field: string, op: string, value: any) => ({
    type: 'where',
    field,
    op,
    value,
  })),
  limit: vi.fn((count: number) => ({
    type: 'limit',
    count,
  })),
  query: vi.fn((collectionRef: CollectionRef, ...constraints: Array<Record<string, any>>): QueryRef => ({
    type: 'query',
    collectionPath: collectionRef.path,
    constraints,
  })),
  getDocs: vi.fn(async (ref: CollectionRef | QueryRef) => {
    takeFailure('getDocs')
    const collectionPath = ref.type === 'query' ? ref.collectionPath : ref.path
    const constraints = ref.type === 'query' ? ref.constraints : []
    const rows = applyConstraints(getCollection(collectionPath), constraints)

    return {
      empty: rows.length === 0,
      docs: rows.map((row) => ({
        id: row.id,
        data: () => clone(row.data),
      })),
    }
  }),
  getDoc: vi.fn(async (ref: DocRef) => {
    takeFailure('getDoc')
    const found = getCollection(ref.collectionPath).find((row) => row.id === ref.id)
    return {
      id: ref.id,
      exists: () => Boolean(found),
      data: () => clone(found?.data || {}),
    }
  }),
  addDoc: vi.fn(async (collectionRef: CollectionRef, data: Record<string, any>) => {
    takeFailure('addDoc')
    const id = `generated-${state.idCounter++}`
    getCollection(collectionRef.path).push({ id, data: clone(data) })
    state.operations.addDoc.push({ collectionPath: collectionRef.path, data: clone(data) })
    return { id }
  }),
  setDoc: vi.fn(async (ref: DocRef, data: Record<string, any>) => {
    takeFailure('setDoc')
    const rows = getCollection(ref.collectionPath)
    const index = rows.findIndex((row) => row.id === ref.id)
    if (index >= 0) {
      rows[index].data = clone(data)
    } else {
      rows.push({ id: ref.id, data: clone(data) })
    }
    state.operations.setDoc.push({ collectionPath: ref.collectionPath, id: ref.id, data: clone(data) })
  }),
  updateDoc: vi.fn(async (ref: DocRef, data: Record<string, any>) => {
    takeFailure('updateDoc')
    const rows = getCollection(ref.collectionPath)
    const found = rows.find((row) => row.id === ref.id)
    if (found) {
      found.data = { ...found.data, ...clone(data) }
    } else {
      rows.push({ id: ref.id, data: clone(data) })
    }
    state.operations.updateDoc.push({ collectionPath: ref.collectionPath, id: ref.id, data: clone(data) })
  }),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  onSnapshot: vi.fn(),
}

const createUserWithEmailAndPassword = vi.fn()
const signInWithEmailAndPassword = vi.fn()
const signInWithPopup = vi.fn()
const signOut = vi.fn()
const sendEmailVerification = vi.fn()
const sendPasswordResetEmail = vi.fn()
const confirmPasswordReset = vi.fn()
const updateProfile = vi.fn()
const updateEmail = vi.fn()
const updatePassword = vi.fn()
const linkWithPhoneNumber = vi.fn()
const signInWithPhoneNumber = vi.fn()
const setPersistence = vi.fn()

export const authMocks = {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  confirmPasswordReset,
  updateProfile,
  updateEmail,
  updatePassword,
  linkWithPhoneNumber,
  signInWithPhoneNumber,
  setPersistence,
}

export const firebaseAuth = {
  browserSessionPersistence: { type: 'browserSessionPersistence' },
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  confirmPasswordReset,
  updateProfile,
  updateEmail,
  updatePassword,
  linkWithPhoneNumber,
  signInWithPhoneNumber,
  setPersistence,
  GoogleAuthProvider: vi.fn(() => googleProvider),
  OAuthProvider: vi.fn(() => appleProvider),
  RecaptchaVerifier: vi.fn(),
}

