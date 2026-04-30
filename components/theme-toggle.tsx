'use client'

import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/contexts/theme-context'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-10 rounded-full border-border bg-card/80 px-3 text-foreground shadow-sm"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      data-testid="theme-toggle-button"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{isDark ? 'Modo claro' : 'Modo escuro'}</span>
    </Button>
  )
}
