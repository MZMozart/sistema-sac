'use client'

export function getPortalContainer() {
  if (typeof document === 'undefined') {
    return undefined
  }

  return document.getElementById('portal-root') ?? undefined
}