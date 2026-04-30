'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DashboardPlaceholderProps {
  title: string
  description?: string
}

export function DashboardPlaceholder({ title, description }: DashboardPlaceholderProps) {
  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 pt-24 p-6 pl-64">
        <h1 className="text-3xl font-bold mb-4">{title}</h1>
        {description && <p className="mb-4 text-muted-foreground">{description}</p>}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Em breve</CardTitle>
          </CardHeader>
          <CardContent>Esta seção ainda está em desenvolvimento.</CardContent>
        </Card>
      </div>
    </div>
  )
}
