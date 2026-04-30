'use client'

import { BadgeCheck } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function VerifiedBadge({ verified, tooltip, className = '' }: { verified?: boolean; tooltip?: string; className?: string }) {
  if (!verified) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center ${className}`} data-testid="company-verified-badge">
            <BadgeCheck className="h-5 w-5 text-sky-500" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}