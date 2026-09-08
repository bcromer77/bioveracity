'use client'

import {
  Droplets, Waves, Factory, Wind, AlertCircle, Volume2, CloudFog,
  Fish, CloudRain, HardHat, Scale, LayoutGrid,
} from 'lucide-react'
import { PLAIN_CATEGORIES, CATEGORY_BY_ID } from '@/lib/categories'

const ICONS: Record<string, any> = {
  Droplets, Waves, Factory, Wind, AlertCircle, Volume2, CloudFog,
  Fish, CloudRain, HardHat, Scale,
}

export function CategoryChips({
  present,
  selected,
  onSelect,
  label = 'What do you want to check?',
}: {
  // category ids that actually have evidence behind them
  present: string[]
  selected: string
  onSelect: (id: string) => void
  label?: string
}) {
  const chips = PLAIN_CATEGORIES.filter((c) => present.includes(c.id))

  return (
    <div>
      <p className="mb-2.5 text-[15px] font-semibold text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        <Chip
          active={selected === 'all'}
          onClick={() => onSelect('all')}
          icon={<LayoutGrid className="h-4 w-4" />}
          text="Everything"
        />
        {chips.map((c) => {
          const Icon = ICONS[c.icon] ?? AlertCircle
          return (
            <Chip
              key={c.id}
              active={selected === c.id}
              onClick={() => onSelect(c.id)}
              icon={<Icon className="h-4 w-4" />}
              text={c.label}
            />
          )
        })}
      </div>
    </div>
  )
}

function Chip({
  active, onClick, icon, text,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; text: string
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[14px] font-medium transition-colors ${
        active
          ? 'border-accent bg-accent text-accent-foreground'
          : 'border-border bg-white text-foreground hover:border-foreground/40'
      }`}
    >
      {icon}
      {text}
    </button>
  )
}

export function categoryLabel(id: string): string {
  return CATEGORY_BY_ID[id]?.label ?? 'this'
}
