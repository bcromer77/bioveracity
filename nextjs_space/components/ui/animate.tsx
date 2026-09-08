'use client'

function animationStyle(delay = 0, duration = 0.4): React.CSSProperties {
  return { animationDelay: `${delay}s`, animationDuration: `${duration}s`, animationFillMode: 'both' }
}

export function FadeIn({
  children, delay = 0, duration = 0.4, className,
}: {
  children: React.ReactNode; delay?: number; duration?: number; className?: string
}) {
  return (
    <div className={`animate-fade-in ${className ?? ''}`} style={animationStyle(delay, duration)}>
      {children}
    </div>
  )
}

export function ScaleIn({
  children, delay = 0, className,
}: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  return (
    <div className={`animate-scale-in ${className ?? ''}`} style={animationStyle(delay, 0.3)}>
      {children}
    </div>
  )
}

export function SlideIn({
  children, from = 'bottom', delay = 0, className,
}: {
  children: React.ReactNode; from?: 'bottom' | 'top' | 'left' | 'right'; delay?: number; className?: string
}) {
  return (
    <div className={`animate-slide-in ${className ?? ''}`} style={animationStyle(delay)} data-slide-from={from}>
      {children}
    </div>
  )
}

export function Stagger({
  children, staggerDelay = 0.08, className,
}: {
  children: React.ReactNode; staggerDelay?: number; className?: string
}) {
  return (
    <div className={className} style={{ '--stagger-delay': `${staggerDelay}s` } as React.CSSProperties}>
      {children}
    </div>
  )
}

export function StaggerItem({
  children, className,
}: {
  children: React.ReactNode; className?: string
}) {
  return (
    <div className={`animate-fade-in ${className ?? ''}`}>
      {children}
    </div>
  )
}

export function HoverLift({
  children, className,
}: {
  children: React.ReactNode; className?: string
}) {
  return (
    <div className={`transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-lg ${className ?? ''}`}>
      {children}
    </div>
  )
}

export function PressScale({
  children, className,
}: {
  children: React.ReactNode; className?: string
}) {
  return (
    <div className={`transition-transform duration-100 active:scale-[0.98] ${className ?? ''}`}>
      {children}
    </div>
  )
}

export function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className ?? ''}`} />
  )
}
