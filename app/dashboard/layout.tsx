'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar'
import { createNotification } from '@/lib/notifications'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, userData, employee, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const currentRole = (employee?.role || userData?.role || 'owner') as 'owner' | 'manager' | 'employee'
  const currentPermissions = employee?.permissions || null
  const today = new Date()
  const currentMinutes = today.getHours() * 60 + today.getMinutes()
  const accessApproved = employee?.tempAccessApprovedUntil ? new Date(employee.tempAccessApprovedUntil).getTime() > Date.now() : false
  const isOutsideWorkingHours = Boolean(
    employee?.workSchedule?.enabled &&
      currentRole !== 'owner' &&
      !accessApproved &&
      (!employee.workSchedule.days?.includes(today.getDay()) || (() => {
        const [startHour, startMinute] = (employee.workSchedule?.start || '08:00').split(':').map(Number)
        const [endHour, endMinute] = (employee.workSchedule?.end || '18:00').split(':').map(Number)
        const start = startHour * 60 + startMinute
        const end = endHour * 60 + endMinute
        return currentMinutes < start || currentMinutes > end
      })())
  )

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

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

  useEffect(() => {
    if (!user || currentRole === 'owner') return

    const accessMap: Record<string, boolean> = {
      '/dashboard': true,
      '/dashboard/chats': true,
      '/dashboard/telephony': true,
      '/dashboard/settings': true,
      '/dashboard/employees': currentPermissions?.canManageEmployees ?? currentRole === 'manager',
      '/dashboard/bot': currentPermissions?.canEditBotPolicies ?? currentRole === 'manager',
      '/dashboard/ratings': currentPermissions?.canViewRatings ?? currentRole === 'manager',
      '/dashboard/reports': currentPermissions?.canExportData ?? currentRole === 'manager',
      '/dashboard/ranking': currentPermissions?.canExportData ?? currentRole === 'manager',
      '/dashboard/auditoria': currentPermissions?.canExportData ?? currentRole === 'manager',
    }

    const matchedEntry = Object.entries(accessMap).find(([route]) => pathname.startsWith(route))
    if (matchedEntry && !matchedEntry[1]) {
      router.replace(currentRole === 'manager' ? '/dashboard/manager' : '/dashboard/attendant')
    }
  }, [currentPermissions, currentRole, pathname, router, user])

  useEffect(() => {
    if (!isOutsideWorkingHours || !employee || !userData?.companyId) return
    const requestKey = `outside-hours-${employee.userId}-${new Date().toDateString()}`
    if (sessionStorage.getItem(requestKey)) return

    createNotification({
      recipientCompanyId: userData.companyId,
      title: 'Solicitação de acesso fora do horário',
      body: `${employee.name || userData.fullName || userData.name || 'Colaborador'} tentou acessar o sistema fora do horário de trabalho configurado.`,
      type: 'system',
      actionUrl: '/dashboard/profile',
      entityId: employee.id,
      entityType: 'profile',
      actorName: employee.name || userData.fullName || userData.name,
      targetUserId: employee.userId,
    })
    sessionStorage.setItem(requestKey, '1')
  }, [employee, isOutsideWorkingHours, userData?.companyId, userData?.fullName, userData?.name])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-primary animate-pulse-glow" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (isOutsideWorkingHours) {
    return (
      <div className="min-h-screen bg-background">
        <Header scope="company" profileHref="/dashboard/profile" settingsHref="/dashboard/settings" />
        <main className="app-main-offset safe-page-x flex min-h-screen items-center justify-center">
          <div className="max-w-xl rounded-[2rem] border border-border bg-card/80 p-8 text-center shadow-[0_24px_80px_-32px_rgba(2,6,23,0.55)]">
            <h1 className="text-2xl font-bold">Acesso fora do horário de trabalho</h1>
            <p className="mt-3 text-sm text-muted-foreground">Sua empresa definiu um horário específico para o seu acesso. Enviamos uma notificação para a empresa aprovar ou negar sua entrada fora do horário.</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header scope="company" profileHref="/dashboard/profile" settingsHref="/dashboard/settings" />
      <Sidebar userType="company" expanded={sidebarOpen} onOpen={() => setSidebarOpen(true)} onClose={() => setSidebarOpen(false)} role={currentRole} permissions={currentPermissions} />
      <main className="app-main-offset safe-page-x min-h-screen transition-all duration-300 lg:pl-24 lg:pr-6">{children}</main>
    </div>
  )
}
