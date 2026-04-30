"use client";

import { useState } from "react";
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

// Removed export const metadata as client components cannot export metadata

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter()
  const pathname = usePathname()
  const isImmersiveRoute = pathname?.startsWith('/cliente/chat/') || pathname?.startsWith('/cliente/call/')

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('twoFactorPending') === '1') {
      router.replace('/auth/login')
    }
  }, [router])

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    const toggle = () => setSidebarOpen((current) => !current)
    window.addEventListener('app-sidebar-toggle', toggle)
    return () => window.removeEventListener('app-sidebar-toggle', toggle)
  }, [])

  return (
    <AuthGuard allowed={[{ accountType: "client" }]}> {/* Route protection */}
      <div className="min-h-screen bg-muted">
        <Header scope="client" profileHref="/cliente/perfil" settingsHref="/cliente/configuracoes" />
        <Sidebar userType="client" expanded={sidebarOpen} onOpen={() => setSidebarOpen(true)} onClose={() => setSidebarOpen(false)} />
        <main className={isImmersiveRoute ? 'mt-16 h-[calc(100dvh-4rem)] overflow-hidden pl-0 lg:pl-24' : 'min-h-screen px-4 pt-20 transition-all duration-300 lg:pl-24 lg:pr-6'}>
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}