import { generateSecret, generateURI, verifySync } from 'otplib'

export function normalizeTwoFactorCode(code: string) {
  return String(code || '').replace(/\D/g, '').slice(0, 6)
}

export function generateTwoFactorSecret() {
  return generateSecret()
}

export function generateTwoFactorUri(label: string, issuer: string, secret: string) {
  return generateURI({ issuer, label, secret })
}

export function verifyTwoFactorCode(code: string, secret: string) {
  const token = normalizeTwoFactorCode(code)
  if (!token || token.length !== 6 || !secret) return false

  try {
    const result = verifySync({
      token,
      secret,
      epochTolerance: 90,
    } as any)

    return Boolean(result?.valid)
  } catch {
    return false
  }
}
