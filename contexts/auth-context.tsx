'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { AuthService } from '@/services/auth-service'
import type { User, AccountType, Company, Employee, UserRole } from '@/lib/types'

interface AuthContextType {
  user: FirebaseUser | null
  userData: User | null
  company: Company | null
  employee: Employee | null
  loading: boolean
  signIn: (email: string, password: string, keepSignedIn?: boolean) => Promise<{ requiresTwoFactor?: boolean } | void>
  signUp: (email: string, password: string, type: AccountType, data: Partial<User>) => Promise<void>
  signInWithGoogle: (type?: AccountType) => Promise<{ requiresTwoFactor?: boolean } | void>
  signInWithApple: (type?: AccountType) => Promise<void>
  signInWithPhone: (phoneNumber: string, recaptchaContainer: HTMLElement, type?: AccountType) => Promise<any>
  confirmPhoneSignIn: (confirmationResult: any, verificationCode: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  signOut: () => Promise<void>
  refreshUserData: () => Promise<void>
  verifyTwoFactorLogin: (code: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [userData, setUserData] = useState<User | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserData = async (firebaseUser: FirebaseUser) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
      if (userDoc.exists()) {
        const data = userDoc.data() as User
        let resolvedData = data

        // Se for PJ, buscar dados da empresa
        if (data.accountType === 'pj' && data.companyId) {
          const companyDoc = await getDoc(doc(db, 'companies', data.companyId))
          if (companyDoc.exists()) {
            const companyData = { id: companyDoc.id, ...companyDoc.data() } as Company
            if ((data.role === 'owner' || (data as any).role === 'owner') && companyData.isActive === false) {
              await updateDoc(doc(db, 'companies', data.companyId), { isActive: true })
              companyData.isActive = true
            }
            setCompany(companyData)
          }

          // Buscar dados do funcionario
          const employeeDoc = await getDoc(doc(db, 'employees', `${data.companyId}_${firebaseUser.uid}`))
          if (employeeDoc.exists()) {
            const employeeData = { id: employeeDoc.id, ...employeeDoc.data() } as Employee
            setEmployee(employeeData)
            resolvedData = { ...data, role: employeeData.role }
          }
        }
        setUserData(resolvedData)
        return resolvedData
      }
      return null
    } catch (error) {
      console.error('Error fetching user data:', error)
      return null
    }
  }

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    let cancelled = false

    const startAuthListener = async () => {
      try {
        await AuthService.applyStoredPersistencePreference()
      } catch {}

      if (cancelled) return

      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setUser(firebaseUser)
        if (firebaseUser) {
          await fetchUserData(firebaseUser)
        } else {
          setUserData(null)
          setCompany(null)
          setEmployee(null)
        }
        setLoading(false)
      })
    }

    startAuthListener()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    if (!AuthService.getPendingGoogleRedirectType()) return

    let cancelled = false
    setLoading(true)

    AuthService.completeGoogleRedirectSignIn()
      .then(async (firebaseUser) => {
        if (!firebaseUser || cancelled) return
        setUser(firebaseUser)
        const data = await fetchUserData(firebaseUser)
        const userType = getUserType(data, employee)

        if ((data as any)?.twoFactorEnabled) {
          sessionStorage.setItem('twoFactorPending', '1')
          sessionStorage.setItem('twoFactorPendingType', userType)
          window.location.href = '/auth/login'
          return
        }

        await finalizeAuthenticatedFlow(firebaseUser, data)
      })
      .catch((error) => {
        console.error('Google redirect sign in error:', error)
        AuthService.clearPendingGoogleRedirectType()
        window.location.href = '/auth/login?googleAuthError=storage'
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const isProfileIncomplete = (data: User | null) => {
    if (!data) return false
    if (data.accountType === 'pf') {
      return !data.cpf || !data.address || !data.phone || !data.name
    }
    return !data.companyId
  }

  const getUserType = (data: User | null, emp: Employee | null):
    | 'cliente'
    | 'empresa_owner'
    | 'empresa_gerente'
    | 'empresa_atendente' => {
    if (!data) return 'cliente'
    if (data.accountType === 'pf') return 'cliente'
    const resolvedRole = (data.role || emp?.role) as UserRole | undefined
    if (resolvedRole === 'owner') return 'empresa_owner'
    if (resolvedRole === 'manager') return 'empresa_gerente'
    if (resolvedRole === 'employee') return 'empresa_atendente'
    if (emp) {
      if (emp.role === 'owner') return 'empresa_owner'
      if (emp.role === 'manager') return 'empresa_gerente'
      if (emp.role === 'employee') return 'empresa_atendente'
    }
    return 'empresa_owner'
  }

  const redirectForType = (type: string) => {
    switch (type) {
      case 'cliente':
        window.location.href = '/cliente/dashboard'
        break
      case 'empresa_owner':
        window.location.href = '/dashboard'
        break
      case 'empresa_gerente':
        window.location.href = '/dashboard'
        break
      case 'empresa_atendente':
        window.location.href = '/dashboard'
        break
      default:
        window.location.href = '/cliente/dashboard'
    }
  }

  const finalizeAuthenticatedFlow = async (firebaseUser: FirebaseUser, data: User | null) => {
    const type = getUserType(data, employee)
    sessionStorage.removeItem('twoFactorPending')
    sessionStorage.removeItem('twoFactorPendingType')

    if (isProfileIncomplete(data)) {
      window.location.href = '/cliente/configuracoes'
    } else if (type === 'empresa_owner' && data && !data.companyId) {
      window.location.href = '/dashboard/setup'
    } else {
      redirectForType(type)
    }
  }

  const signIn = async (email: string, password: string, keepSignedIn = false) => {
    setLoading(true)
    try {
      const firebaseUser = await AuthService.signIn(email, password, keepSignedIn)
      const data = await fetchUserData(firebaseUser)
      const type = getUserType(data, employee)

      if ((data as any)?.twoFactorEnabled) {
        sessionStorage.setItem('twoFactorPending', '1')
        sessionStorage.setItem('twoFactorPendingType', type)
        return { requiresTwoFactor: true }
      }

      await finalizeAuthenticatedFlow(firebaseUser, data)
    } catch (error: any) {
      console.error('Sign in error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, type: AccountType, data: Partial<User>) => {
    setLoading(true)
    try {
      await AuthService.signUp(email, password, type, data)
      // Busca os dados do usuário após o cadastro
      const firebaseUser = auth.currentUser;
      let userDataObj = null;
      if (firebaseUser) {
        userDataObj = await fetchUserData(firebaseUser);
      }
      if (type === 'pj') {
        window.location.href = '/dashboard/setup'
      } else {
        window.location.href = '/cliente/dashboard'
      }
    } catch (error: any) {
      console.error('Sign up error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = async (type?: AccountType) => {
    setLoading(true)
    try {
      const firebaseUser = await AuthService.signInWithGoogle(type)
      const data = await fetchUserData(firebaseUser)
      const userType = getUserType(data, employee)
      if ((data as any)?.twoFactorEnabled) {
        sessionStorage.setItem('twoFactorPending', '1')
        sessionStorage.setItem('twoFactorPendingType', userType)
        return { requiresTwoFactor: true }
      }

      await finalizeAuthenticatedFlow(firebaseUser, data)
    } catch (error: any) {
      console.error('Google sign in error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signInWithApple = async (type?: AccountType) => {
    setLoading(true)
    try {
      const firebaseUser = await AuthService.signInWithApple(type)
      const data = await fetchUserData(firebaseUser)

      const userType = getUserType(data, employee)
      if (isProfileIncomplete(data)) {
        window.location.href = '/cliente/configuracoes'
      } else if (userType === 'empresa_owner' && data && !data.companyId) {
        window.location.href = '/dashboard/setup'
      } else {
        redirectForType(userType)
      }
    } catch (error: any) {
      console.error('Apple sign in error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signInWithPhone = async (phoneNumber: string, recaptchaContainer: HTMLElement, type?: AccountType) => {
    setLoading(true)
    try {
      const confirmationResult = await AuthService.signInWithPhone(phoneNumber, recaptchaContainer, type)
      return confirmationResult
    } catch (error: any) {
      console.error('Phone sign in error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const confirmPhoneSignIn = async (confirmationResult: any, verificationCode: string) => {
    setLoading(true)
    try {
      const firebaseUser = await AuthService.confirmPhoneSignIn(confirmationResult, verificationCode)
      const data = await fetchUserData(firebaseUser)

      const userType = getUserType(data, employee)
      if (isProfileIncomplete(data)) {
        window.location.href = '/cliente/configuracoes'
      } else if (userType === 'empresa_owner' && data && !data.companyId) {
        window.location.href = '/dashboard/setup'
      } else {
        redirectForType(userType)
      }
    } catch (error: any) {
      console.error('Phone confirmation error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (email: string) => {
    try {
      await AuthService.resetPassword(email)
    } catch (error: any) {
      console.error('Reset password error:', error)
      throw error
    }
  }

  const signOut = async () => {
    try {
      await AuthService.signOut()
      sessionStorage.removeItem('twoFactorPending')
      sessionStorage.removeItem('twoFactorPendingType')
      setUser(null)
      setUserData(null)
      setCompany(null)
      setEmployee(null)
    } catch (error: any) {
      console.error('Sign out error:', error)
      throw error
    }
  }

  const refreshUserData = async () => {
    if (user) {
      await fetchUserData(user)
    }
  }

  const verifyTwoFactorLogin = async (code: string) => {
    const firebaseUser = auth.currentUser
    if (!firebaseUser) throw new Error('not-authenticated')

    const token = await firebaseUser.getIdToken()
    const response = await fetch('/api/twofactor/verify-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code }),
    })

    const result = await response.json()
    if (!response.ok) {
      const error = new Error(result.error || 'twofactor-verification-failed') as Error & { status?: number }
      error.status = response.status
      throw error
    }

    const data = await fetchUserData(firebaseUser)
    await finalizeAuthenticatedFlow(firebaseUser, data)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        company,
        employee,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithApple,
        signInWithPhone,
        confirmPhoneSignIn,
        resetPassword,
        signOut,
        refreshUserData,
        verifyTwoFactorLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
