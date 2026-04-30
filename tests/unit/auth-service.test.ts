import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthService } from '@/services/auth-service'
import { auth, authMocks, getMockCollection, resetFirebaseMocks } from '../mocks/firebase'

describe('AuthService', () => {
  beforeEach(() => {
    resetFirebaseMocks()
  })

  it('cadastra usuario por email e cria documento no Firestore', async () => {
    const firebaseUser = { uid: 'user-1', email: 'cliente@teste.com' }
    authMocks.createUserWithEmailAndPassword.mockResolvedValue({ user: firebaseUser })

    const result = await AuthService.signUp('cliente@teste.com', 'secret123', 'pf', {
      name: 'Cliente Teste',
      phone: '11999999999',
    })

    expect(result).toBe(firebaseUser)
    expect(authMocks.setPersistence).toHaveBeenCalled()
    expect(authMocks.createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, 'cliente@teste.com', 'secret123')
    expect(authMocks.sendEmailVerification).toHaveBeenCalledWith(firebaseUser)
    expect(getMockCollection('users')).toEqual([
      expect.objectContaining({
        id: 'user-1',
        uid: 'user-1',
        email: 'cliente@teste.com',
        name: 'Cliente Teste',
        accountType: 'pf',
        role: 'client',
        connectedAccounts: ['email'],
      }),
    ])
  })

  it('faz login e devolve usuario autenticado', async () => {
    const firebaseUser = { uid: 'user-1', email: 'cliente@teste.com' }
    authMocks.signInWithEmailAndPassword.mockResolvedValue({ user: firebaseUser })

    await expect(AuthService.signIn('cliente@teste.com', 'secret123')).resolves.toBe(firebaseUser)
    expect(authMocks.signInWithEmailAndPassword).toHaveBeenCalledWith(auth, 'cliente@teste.com', 'secret123')
  })

  it('propaga erro de autenticacao para o formulario tratar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    authMocks.signInWithEmailAndPassword.mockRejectedValue(new Error('auth/wrong-password'))

    await expect(AuthService.signIn('cliente@teste.com', 'errada')).rejects.toThrow('auth/wrong-password')
  })

  it('exige usuario atual para enviar verificacao de email', async () => {
    auth.currentUser = null

    await expect(AuthService.sendCurrentEmailVerification()).rejects.toThrow('auth/no-current-user')
  })
})

