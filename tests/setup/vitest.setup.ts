import '@testing-library/jest-dom/vitest'
import React from 'react'
import { afterEach, vi } from 'vitest'

(globalThis as any).React = React

vi.mock('firebase/firestore', async () => {
  const { firestore } = await import('../mocks/firebase')
  return firestore
})

vi.mock('firebase/auth', async () => {
  const { firebaseAuth } = await import('../mocks/firebase')
  return firebaseAuth
})

vi.mock('@/lib/firebase', async () => {
  const { appFirebase } = await import('../mocks/firebase')
  return appFirebase
})

afterEach(() => {
  vi.restoreAllMocks()
})
