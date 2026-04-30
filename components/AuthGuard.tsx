"use client"

import React, { ReactNode, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"

type AccountType = "client" | "company"
type Role = "owner" | "manager" | "agent"

type Permission = {
  accountType: AccountType
  role?: Role
}

type UserData = {
  accountType: AccountType
  role?: Role
}

interface AuthGuardProps {
  allowed: Permission[]
  children: ReactNode
}

export function AuthGuard({ allowed, children }: AuthGuardProps) {
  const { user, userData, loading } = useAuth() as {
    user: any
    userData: UserData | null
    loading: boolean
  }

  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (!user || !userData) {
      router.push("/auth/login")
      return
    }

    const match = allowed.some(
      (perm) =>
        userData.accountType === perm.accountType &&
        (!perm.role || userData.role === perm.role)
    )

    if (!match) {
      if (userData.accountType === "client") {
        router.push("/cliente/dashboard")
      } else if (userData.accountType === "company") {
        switch (userData.role) {
          case "owner":
            router.push("/empresa/dashboard")
            break
          case "manager":
            router.push("/empresa/gestao")
            break
          case "agent":
            router.push("/empresa/atendimento")
            break
          default:
            router.push("/auth/login")
        }
      }
    }
  }, [user, userData, loading, allowed, router])

  if (loading) return null

  return <>{children}</>
}