'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function QueuesPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/telephony')
  }, [router])

  return null
}
