import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  confirmPasswordReset,
  updateProfile,
  updateEmail as firebaseUpdateEmail,
  updatePassword as firebaseUpdatePassword,
  linkWithPhoneNumber,
  type User as FirebaseUser,
  GoogleAuthProvider,
  OAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  setPersistence,
  type ConfirmationResult,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider, appleProvider } from '@/lib/firebase'
import type { User, AccountType, Company } from '@/lib/types'

const googleRedirectAccountTypeKey = 'atendepro.googleRedirect.accountType'
const googleRegisterAccountTypeKey = 'atendepro.googleRegister.accountType'
const keepSignedInKey = 'atendepro.auth.keepSignedIn'

export class AuthService {
  static async ensureTabScopedSession() {
    await setPersistence(auth, browserSessionPersistence)
  }

  static async ensureDeviceScopedSession() {
    await setPersistence(auth, browserLocalPersistence)
  }

  static getKeepSignedInPreference() {
    if (typeof window === 'undefined') return true
    try {
      return window.localStorage.getItem(keepSignedInKey) !== '0'
    } catch {
      return true
    }
  }

  static setKeepSignedInPreference(keepSignedIn: boolean) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(keepSignedInKey, keepSignedIn ? '1' : '0')
    } catch {}
  }

  static async applyStoredPersistencePreference() {
    if (this.getKeepSignedInPreference()) {
      await this.ensureDeviceScopedSession()
    } else {
      await this.ensureTabScopedSession()
    }
  }

  static isEmbeddedApp() {
    if (typeof window === 'undefined') return false
    const runtime = window as any
    return Boolean(runtime.desktopShell?.isDesktop || runtime.Capacitor?.isNativePlatform?.())
  }

  static getPendingGoogleRedirectType(): AccountType | null {
    if (typeof window === 'undefined') return null
    try {
      return window.localStorage.getItem(googleRedirectAccountTypeKey) as AccountType | null
    } catch {
      return null
    }
  }

  static clearPendingGoogleRedirectType() {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(googleRedirectAccountTypeKey)
    } catch {
      // O armazenamento local pode estar indisponível em navegadores restritos.
    }
  }

  static getPendingGoogleRegistrationType(): AccountType | null {
    if (typeof window === 'undefined') return null
    try {
      return window.localStorage.getItem(googleRegisterAccountTypeKey) as AccountType | null
    } catch {
      return null
    }
  }

  static clearPendingGoogleRegistrationType() {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(googleRegisterAccountTypeKey)
    } catch {
      // O armazenamento local pode estar indisponível em navegadores restritos.
    }
  }

  private static async persistGoogleUser(firebaseUser: FirebaseUser, accountType?: AccountType) {
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))

    if (!userDoc.exists()) {
      const newUser: Omit<User, 'uid' | 'createdAt'> = {
        name: firebaseUser.displayName || '',
        email: firebaseUser.email || '',
        phone: firebaseUser.phoneNumber || '',
        accountType: accountType || 'pf',
        role: accountType === 'pj' ? 'owner' : 'client',
        photoURL: firebaseUser.photoURL || undefined,
        emailVerified: firebaseUser.emailVerified,
        phoneVerified: !!firebaseUser.phoneNumber,
        connectedAccounts: ['google'],
      }

      await setDoc(doc(db, 'users', firebaseUser.uid), {
        uid: firebaseUser.uid,
        ...newUser,
        createdAt: serverTimestamp(),
      })
    }
  }

  static async completeGoogleRedirectSignIn(): Promise<FirebaseUser | null> {
    const pendingAccountType = this.getPendingGoogleRedirectType()
    if (!pendingAccountType) return null

    await this.ensureDeviceScopedSession()
    const result = await getRedirectResult(auth)

    if (!result?.user) {
      this.clearPendingGoogleRedirectType()
      return null
    }

    await this.persistGoogleUser(result.user, pendingAccountType)
    this.clearPendingGoogleRedirectType()
    return result.user
  }

  static async startGoogleRegistration(accountType: AccountType): Promise<FirebaseUser> {
    await this.ensureDeviceScopedSession()

    if (this.isEmbeddedApp()) {
      window.localStorage.setItem(googleRegisterAccountTypeKey, accountType)
      await signInWithRedirect(auth, googleProvider)
      return await new Promise<FirebaseUser>(() => undefined)
    }

    const result = await signInWithPopup(auth, googleProvider)
    return result.user
  }

  static async completeGoogleRegistrationRedirect(): Promise<{ user: FirebaseUser; accountType: AccountType } | null> {
    const pendingAccountType = this.getPendingGoogleRegistrationType()
    if (!pendingAccountType) return null

    await this.ensureDeviceScopedSession()
    const result = await getRedirectResult(auth)
    this.clearPendingGoogleRegistrationType()

    if (!result?.user) return null
    return { user: result.user, accountType: pendingAccountType }
  }

  static async finishGoogleRegistration(accountType: AccountType, userData: Partial<User>): Promise<FirebaseUser> {
    const firebaseUser = auth.currentUser
    if (!firebaseUser) {
      throw Object.assign(new Error('auth/no-current-user'), { code: 'auth/no-current-user' })
    }

    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
    if (userDoc.exists()) {
      throw Object.assign(new Error('auth/email-already-in-use'), { code: 'auth/email-already-in-use' })
    }

    const newUser: Omit<User, 'uid' | 'createdAt'> = {
      name: userData.name || userData.fullName || firebaseUser.displayName || '',
      email: firebaseUser.email || userData.email || '',
      phone: userData.phone || firebaseUser.phoneNumber || '',
      accountType,
      role: accountType === 'pj' ? 'owner' : 'client',
      photoURL: firebaseUser.photoURL || userData.photoURL,
      emailVerified: firebaseUser.emailVerified,
      phoneVerified: Boolean(firebaseUser.phoneNumber),
      connectedAccounts: ['google'],
      ...userData,
    }

    await setDoc(doc(db, 'users', firebaseUser.uid), {
      uid: firebaseUser.uid,
      ...newUser,
      createdAt: serverTimestamp(),
    })

    return firebaseUser
  }

  // Autenticação por e-mail e senha
  static async signUp(
    email: string,
    password: string,
    accountType: AccountType,
    userData: Partial<User>
  ): Promise<FirebaseUser> {
    try {
      await this.ensureTabScopedSession()
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const firebaseUser = userCredential.user

      // Envia verificação de e-mail
      try {
        await sendEmailVerification(firebaseUser)
      } catch (error) {
        console.warn('Não foi possível enviar o e-mail de verificação:', error)
      }

      // Cria o documento do usuário no Firestore
      const userDoc: Omit<User, 'uid' | 'createdAt'> = {
        name: userData.name || userData.fullName || '',
        email,
        phone: userData.phone || '',
        accountType,
        role: accountType === 'pj' ? 'owner' : 'client',
        emailVerified: false,
        phoneVerified: false,
        connectedAccounts: ['email'],
        ...userData,
      }

      await setDoc(doc(db, 'users', firebaseUser.uid), {
        uid: firebaseUser.uid,
        ...userDoc,
        createdAt: serverTimestamp(),
      })
      return firebaseUser
    } catch (error) {
      console.error('Sign up error:', error)
      throw error
    }
  }

  static async signIn(email: string, password: string, keepSignedIn = false): Promise<FirebaseUser> {
    try {
      if (keepSignedIn) {
        await this.ensureDeviceScopedSession()
      } else {
        await this.ensureTabScopedSession()
      }
      this.setKeepSignedInPreference(keepSignedIn)
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      return userCredential.user
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  }

  // Autenticação com Google
  static async signInWithGoogle(accountType?: AccountType): Promise<FirebaseUser> {
    try {
      await this.ensureDeviceScopedSession()

      if (this.isEmbeddedApp()) {
        window.localStorage.setItem(googleRedirectAccountTypeKey, accountType || 'pf')
        await signInWithRedirect(auth, googleProvider)
        return await new Promise<FirebaseUser>(() => undefined)
      }

      const result = await signInWithPopup(auth, googleProvider)
      const firebaseUser = result.user

      await this.persistGoogleUser(firebaseUser, accountType)

      return firebaseUser
    } catch (error) {
      console.error('Google sign in error:', error)
      throw error
    }
  }

  // Autenticação com Apple
  static async signInWithApple(accountType?: AccountType): Promise<FirebaseUser> {
    try {
      await this.ensureTabScopedSession()
      const result = await signInWithPopup(auth, appleProvider)
      const firebaseUser = result.user

      // Verifica se o usuário existe no Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))

      if (!userDoc.exists()) {
        // Cria um novo usuário
        const newUser: Omit<User, 'uid' | 'createdAt'> = {
          name: firebaseUser.displayName || '',
          email: firebaseUser.email || '',
          phone: '',
          accountType: accountType || 'pf',
          role: accountType === 'pj' ? 'owner' : 'client',
          emailVerified: firebaseUser.emailVerified,
          phoneVerified: false,
          connectedAccounts: ['apple'],
        }

        await setDoc(doc(db, 'users', firebaseUser.uid), {
          uid: firebaseUser.uid,
          ...newUser,
          createdAt: serverTimestamp(),
        })
      }

      return firebaseUser
    } catch (error) {
      console.error('Apple sign in error:', error)
      throw error
    }
  }

  // Autenticação por telefone
  static async signInWithPhone(
    phoneNumber: string,
    recaptchaContainer: HTMLElement,
    accountType?: AccountType
  ): Promise<ConfirmationResult> {
    try {
      await this.ensureTabScopedSession()
      const recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainer, {
        size: 'invisible',
      })

      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier)

      // Guarda o tipo de conta para concluir o fluxo depois
      sessionStorage.setItem('pendingAccountType', accountType || 'pf')

      return confirmationResult
    } catch (error) {
      console.error('Phone sign in error:', error)
      throw error
    }
  }

  static async confirmPhoneSignIn(
    confirmationResult: ConfirmationResult,
    verificationCode: string
  ): Promise<FirebaseUser> {
    try {
      const result = await confirmationResult.confirm(verificationCode)
      const firebaseUser = result.user
      const accountType = sessionStorage.getItem('pendingAccountType') as AccountType || 'pf'

      // Verifica se o usuário existe no Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))

      if (!userDoc.exists()) {
        // Cria um novo usuário
        const newUser: Omit<User, 'uid' | 'createdAt'> = {
          name: firebaseUser.displayName || '',
          email: firebaseUser.email || '',
          phone: firebaseUser.phoneNumber || '',
          accountType,
          role: accountType === 'pj' ? 'owner' : 'client',
          emailVerified: firebaseUser.emailVerified,
          phoneVerified: true,
          connectedAccounts: ['phone'],
        }

        await setDoc(doc(db, 'users', firebaseUser.uid), {
          uid: firebaseUser.uid,
          ...newUser,
          createdAt: serverTimestamp(),
        })
      }

      sessionStorage.removeItem('pendingAccountType')
      return firebaseUser
    } catch (error) {
      console.error('Phone confirmation error:', error)
      throw error
    }
  }

  // Redefinição de senha
  static async resetPassword(email: string): Promise<void> {
    try {
      const normalizedEmail = email.trim().toLowerCase()
      const actionCodeSettings = typeof window !== 'undefined'
        ? {
            url: `${window.location.origin}/auth/login`,
            handleCodeInApp: false,
          }
        : undefined

      const signInMethods = await fetchSignInMethodsForEmail(auth, normalizedEmail).catch(() => null)
      if (signInMethods && signInMethods.length > 0 && !signInMethods.includes('password')) {
        throw new Error('auth/no-password-provider')
      }

      await sendPasswordResetEmail(auth, normalizedEmail, actionCodeSettings)
    } catch (error) {
      console.error('Password reset error:', error)
      throw error
    }
  }

  static async sendCurrentEmailVerification(): Promise<void> {
    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error('auth/no-current-user')
    }

    await sendEmailVerification(currentUser)
  }

  static async startPhoneVerification(
    phoneNumber: string,
    recaptchaContainer: HTMLElement
  ): Promise<ConfirmationResult> {
    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error('auth/no-current-user')
    }

    const recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainer, {
      size: 'invisible',
    })

    return linkWithPhoneNumber(currentUser, phoneNumber, recaptchaVerifier)
  }

  static async confirmPhoneVerification(confirmationResult: ConfirmationResult, verificationCode: string): Promise<void> {
    const result = await confirmationResult.confirm(verificationCode)
    const currentUser = result.user
    await updateDoc(doc(db, 'users', currentUser.uid), {
      phone: currentUser.phoneNumber,
      phoneVerified: true,
    })
  }

  static async confirmPasswordReset(oobCode: string, newPassword: string): Promise<void> {
    try {
      await confirmPasswordReset(auth, oobCode, newPassword)
    } catch (error) {
      console.error('Password reset confirmation error:', error)
      throw error
    }
  }

  // Sair da conta
  static async signOut(): Promise<void> {
    try {
      this.setKeepSignedInPreference(false)
      await firebaseSignOut(auth)
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }

  // Atualização de perfil
  static async updateProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
    try {
      const currentUser = auth.currentUser
      if (currentUser) {
        await updateProfile(currentUser, updates)

        // Atualiza também no Firestore
        await updateDoc(doc(db, 'users', currentUser.uid), updates)
      }
    } catch (error) {
      console.error('Update profile error:', error)
      throw error
    }
  }

  // Atualização de e-mail
  static async updateEmail(newEmail: string): Promise<void> {
    try {
      const currentUser = auth.currentUser
      if (currentUser) {
        await firebaseUpdateEmail(currentUser, newEmail)
        await updateDoc(doc(db, 'users', currentUser.uid), { email: newEmail })
      }
    } catch (error) {
      console.error('Update email error:', error)
      throw error
    }
  }

  // Atualização de senha
  static async updatePassword(newPassword: string): Promise<void> {
    try {
      const currentUser = auth.currentUser
      if (currentUser) {
        await firebaseUpdatePassword(currentUser, newPassword)
      }
    } catch (error) {
      console.error('Update password error:', error)
      throw error
    }
  }
}
