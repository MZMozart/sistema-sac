'use client'

import { useEffect, useState } from 'react'
import { Maximize2, Minus, Square, X } from 'lucide-react'
import { Logo } from '@/components/logo'

declare global {
  interface Window {
    desktopShell?: {
      isDesktop?: boolean
      platform?: string
      minimize?: () => Promise<void>
      toggleMaximize?: () => Promise<boolean>
      close?: () => Promise<void>
    }
  }
}

export function DesktopWindowFrame() {
  const [isDesktop, setIsDesktop] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const enabled = Boolean(window.desktopShell?.isDesktop)
    setIsDesktop(enabled)
    document.documentElement.classList.toggle('desktop-shell', enabled)

    return () => {
      document.documentElement.classList.remove('desktop-shell')
    }
  }, [])

  if (!isDesktop) return null

  const toggleMaximize = async () => {
    const maximized = await window.desktopShell?.toggleMaximize?.()
    setIsMaximized(Boolean(maximized))
  }

  return (
    <div className="desktop-titlebar fixed inset-x-0 top-0 z-[100] flex h-9 select-none items-center justify-between border-b border-border/80 bg-background/95 px-3 text-foreground shadow-[0_10px_34px_-28px_rgba(15,23,42,0.75)] backdrop-blur-xl">
      <div className="desktop-titlebar-drag flex h-full flex-1 items-center gap-2">
        <Logo size="sm" />
        <span className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:inline">AtendePro</span>
      </div>
      <div className="desktop-window-controls flex h-full items-center gap-1">
        <button
          type="button"
          className="desktop-window-button"
          aria-label="Minimizar"
          title="Minimizar"
          onClick={() => window.desktopShell?.minimize?.()}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="desktop-window-button"
          aria-label={isMaximized ? 'Restaurar janela' : 'Maximizar'}
          title={isMaximized ? 'Restaurar janela' : 'Maximizar'}
          onClick={toggleMaximize}
        >
          {isMaximized ? <Square className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          className="desktop-window-button desktop-window-button-close"
          aria-label="Fechar"
          title="Fechar"
          onClick={() => window.desktopShell?.close?.()}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
