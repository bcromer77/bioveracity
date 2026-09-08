'use client'

import { getEvidenceDisplay } from '@/lib/evidence-taxonomy'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function EvidenceBadge({ classCode, showLabel = false }: { classCode: string; showLabel?: boolean }) {
  const meta = getEvidenceDisplay(classCode ?? 'A')
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 text-xs font-mono cursor-help ${meta?.cssClass ?? ''}`}>
            <span className="text-sm">{meta?.symbol ?? '△'}</span>
            {showLabel && <span className="font-sans">{meta?.label ?? 'Unknown'}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs font-medium">{meta?.label ?? 'Unknown'}</p>
          <p className="text-xs text-muted-foreground">{meta?.description ?? ''}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function EvidenceLegend() {
  const items = [
    { symbol: '●', label: 'Verified Record', cssClass: 'evidence-verified', desc: 'Regulator / statutory record' },
    { symbol: '◐', label: 'Official / Operator', cssClass: 'evidence-corroborated', desc: 'Government or operator statement' },
    { symbol: '○', label: 'Public / Community', cssClass: 'evidence-unverified', desc: 'Community or media report' },
    { symbol: '△', label: 'BioVeracity Analysis', cssClass: 'evidence-inference', desc: 'Analytical inference' },
    { symbol: '□', label: 'Evidence Gap', cssClass: 'evidence-gap', desc: 'The record is silent' },
  ]
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
      {items?.map((item: any) => (
        <span key={item?.label} className={`inline-flex items-center gap-1.5 ${item?.cssClass ?? ''}`} title={item?.desc}>
          <span className="text-sm">{item?.symbol}</span>
          <span>{item?.label}</span>
        </span>
      ))}
    </div>
  )
}
