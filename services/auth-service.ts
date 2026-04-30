import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
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

export class AuthService {
  static async ensureTabScopedSession() {
    await setPersistence(auth, browserSessionPersistence)
  }

  // Email and Password Authentication
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

      // Send email verification
      try {
        await sendEmailVerification(firebaseUser)
      } catch (error) {
        console.warn('Could not send verification email:', error)
      }

      // Create user document in Firestore
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

  static async signIn(email: string, password: string): Promise<FirebaseUser> {
    try {
      await this.ensureTabScopedSession()
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      return userCredential.user
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  }

  // Google Authentication
  static async signInWithGoogle(accountType?: AccountType): Promise<FirebaseUser> {
    try {
      await this.ensureTabScopedSession()
      const result = await signInWithPopup(auth, googleProvider)
      const firebaseUser = result.user

      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))

      if (!userDoc.exists()) {
        // Create new user
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

      return firebaseUser
    } catch (error) {
      console.error('Google sign in error:', error)
      throw error
    }
  }

  // Apple Authentication
  static async signInWithApple(accountType?: AccountType): Promise<FirebaseUser> {
    try {
      await this.ensureTabScopedSession()
      const result = await signInWithPopup(auth, appleProvider)
      const firebaseUser = result.user

      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))

      if (!userDoc.exists()) {
        // Create new user
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

  // Phone Authentication
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

      // Store accountType for later use
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

      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))

      if (!userDoc.exists()) {
        // Create new user
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

  // Password Reset
  static async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email)
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

  // Sign Out
  static async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth)
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }

  // Update Profile
  static async updateProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
    try {
      const currentUser = auth.currentUser
      if (currentUser) {
        await updateProfile(currentUser, updates)

        // Update in Firestore too
        await updateDoc(doc(db, 'users', currentUser.uid), updates)
      }
    } catch (error) {
      console.error('Update profile error:', error)
      throw error
    }
  }

  // Update Email
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

  // Update Password
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
