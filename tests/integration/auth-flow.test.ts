import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthService } from '@/services/auth-service'
import DashboardLayout from '@/app/dashboard/layout'
import { auth, authMocks, resetFirebaseMocks } from '../mocks/firebase'

const mocks = vi.hoisted(() => ({
  authState: {
    user: null as any,
    userData: null as any,
    employee: null as any,
    loading: false,
  },
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.routerPush, replace: mocks.routerReplace }),
  usePathname: () => '/dashboard',
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mocks.authState,
}))

vi.mock('@/components/layout/header', () => ({
  Header: () => React.createElement('header', { 'data-testid': 'dashboard-header' }),
}))

vi.mock('@/components/layout/sidebar', () => ({
  Sidebar: () => React.createElement('aside', { 'data-testid': 'dashboard-sidebar' }),
}))

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn(),
}))

describe('fluxo de autenticacao e rota protegida', () => {
  beforeEach(() => {
    resetFirebaseMocks()
    mocks.routerPush.mockReset()
    mocks.routerReplace.mockReset()
    mocks.authState.user = null
    mocks.authState.userData = null
    mocks.authState.employee = null
    mocks.authState.loading = false
  })

  it('faz login e permite renderizar conteudo protegido', async () => {
    const firebaseUser = {
      uid: 'owner-1',
      email: 'empresa@teste.com',
      displayName: 'Empresa Teste',
    }
    authMocks.signInWithEmailAndPassword.mockResolvedValue({ user: firebaseUser })

    const loggedUser = await AuthService.signIn('empresa@teste.com', 'secret123')
    auth.currentUser = loggedUser
    mocks.authState.user = loggedUser
    mocks.authState.userData = { uid: 'owner-1', accountType: 'pj', role: 'owner', companyId: 'company-1' }

    render(React.createElement(DashboardLayout, null, React.createElement('main', null, 'Conteudo protegido')))

    expect(screen.getByText('Conteudo protegido')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-header')).toBeInTheDocument()
    expect(mocks.routerPush).not.toHaveBeenCalled()
  })

  it('redireciona visitante sem login para a tela de login', async () => {
    render(React.createElement(DashboardLayout, null, React.createElement('main', null, 'Conteudo protegido')))

    await waitFor(() => {
      expect(mocks.routerPush).toHaveBeenCalledWith('/auth/login')
    })
    expect(screen.queryByText('Conteudo protegido')).not.toBeInTheDocument()
  })
})

