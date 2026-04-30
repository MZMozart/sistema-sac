'use client'

import { cn } from '@/lib/utils'

type LogoProps = {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

const BRAND_LOGO_URL = '/apple-icon.png'

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const dimensions = size === 'sm' ? 'h-12 w-12' : size === 'lg' ? 'h-20 w-20' : 'h-14 w-14'
  const textSize = size === 'sm' ? 'text-xl' : size === 'lg' ? 'text-3xl' : 'text-2xl'

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('flex items-center justify-center', dimensions)}>
        <img src={BRAND_LOGO_URL} alt="Logo da plataforma" className="h-full w-full object-contain" data-testid="platform-logo-image" />
      </div>
      {showText ? (
        <div className="leading-tight">
          <span className={cn('block font-semibold tracking-tight text-foreground', textSize)}>ATENDE PRO</span>
        </div>
      ) : null}
    </div>
  )
}
