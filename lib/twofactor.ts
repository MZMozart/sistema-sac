import { createHmac } from 'node:crypto'
import { generateSecret, generateURI } from 'otplib'

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function normalizeTwoFactorCode(code: string) {
  return String(code || '').replace(/\D/g, '').slice(0, 6)
}

export function generateTwoFactorSecret() {
  return generateSecret()
}

export function generateTwoFactorUri(label: string, issuer: string, secret: string) {
  return generateURI({ issuer, label, secret })
}

function normalizeSecret(secret: string) {
  const value = String(secret || '').trim()
  if (value.startsWith('otpauth://')) {
    try {
      return new URL(value).searchParams.get('secret') || ''
    } catch {
      return ''
    }
  }
  return value
}

function decodeBase32(secret: string) {
  const cleanSecret = normalizeSecret(secret).toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = ''
  const bytes: number[] = []

  for (const char of cleanSecret) {
    const value = base32Alphabet.indexOf(char)
    if (value < 0) continue
    bits += value.toString(2).padStart(5, '0')
    while (bits.length >= 8) {
      bytes.push(parseInt(bits.slice(0, 8), 2))
      bits = bits.slice(8)
    }
  }

  return Buffer.from(bytes)
}

function generateTotp(secret: string, timeStep: number) {
  const key = decodeBase32(secret)
  if (!key.length) return null

  const counter = Buffer.alloc(8)
  counter.writeUInt32BE(Math.floor(timeStep / 0x100000000), 0)
  counter.writeUInt32BE(timeStep >>> 0, 4)

  const hmac = createHmac('sha1', key).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const binary = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff)

  return String(binary % 1_000_000).padStart(6, '0')
}

export function verifyTwoFactorCode(code: string, secret: string) {
  const token = normalizeTwoFactorCode(code)
  if (!token || token.length !== 6 || !secret) return false

  try {
    const currentStep = Math.floor(Date.now() / 1000 / 30)
    for (let drift = -3; drift <= 3; drift += 1) {
      if (generateTotp(secret, currentStep + drift) === token) {
        return true
      }
    }
  } catch {
    return false
  }

  return false
}
