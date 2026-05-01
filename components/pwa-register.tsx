'use client'

import { useEffect, useState } from 'react'
import { Download, RefreshCw, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    setIsAndroid(/android/i.test(window.navigator.userAgent))

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const handleInstalled = () => setInstalled(true)
    let cleanupServiceWorker = () => undefined

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        const watchInstallingWorker = (worker: ServiceWorker) => {
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(worker)
            }
          })
        }

        if (registration.waiting) {
          setWaitingWorker(registration.waiting)
        }

        registration.addEventListener('updatefound', () => {
          if (registration.installing) {
            watchInstallingWorker(registration.installing)
          }
        })

        registration.update().catch(() => null)
      }).catch(() => null)

      let reloaded = false
      const handleControllerChange = () => {
        if (reloaded) return
        reloaded = true
        window.location.reload()
      }

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

      cleanupServiceWorker = () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      cleanupServiceWorker()
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const handleApplyUpdate = () => {
    if (!waitingWorker) {
      window.location.reload()
      return
    }

    setRefreshing(true)
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  }

  if (waitingWorker) {
    return (
      <div className="fixed bottom-4 left-1/2 z-[70] w-[min(92vw,720px)] -translate-x-1/2 rounded-3xl border border-primary/20 bg-card/92 p-4 shadow-[0_24px_60px_-34px_rgba(37,99,235,0.55)] backdrop-blur-xl" data-testid="app-update-banner">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-primary text-white">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Atualização disponível</p>
              <p className="text-sm text-muted-foreground">Uma nova versão do sistema já está pronta. Atualize para carregar as mudanças mais recentes.</p>
            </div>
          </div>
          <Button onClick={handleApplyUpdate} disabled={refreshing} data-testid="app-update-button">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar sistema
          </Button>
        </div>
      </div>
    )
  }

  if (!deferredPrompt || installed) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-[70] w-[min(92vw,720px)] -translate-x-1/2 rounded-3xl border border-primary/20 bg-card/92 p-4 shadow-[0_24px_60px_-34px_rgba(37,99,235,0.55)] backdrop-blur-xl" data-testid="pwa-install-banner">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-primary text-white">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Instale o app no celular ou desktop</p>
            <p className="text-sm text-muted-foreground">{isAndroid ? 'No Android, adicione à tela inicial para abrir como app completo.' : 'Abra como aplicativo com atalho próprio, tela cheia e acesso rápido.'}</p>
          </div>
        </div>
        <Button
          onClick={async () => {
            await deferredPrompt.prompt()
            await deferredPrompt.userChoice
            setDeferredPrompt(null)
          }}
          data-testid="pwa-install-button"
        >
          <Download className="mr-2 h-4 w-4" />
          {isAndroid ? 'Instalar no Android' : 'Instalar app'}
        </Button>
      </div>
    </div>
  )
}
