// ─── Accessible UI kit (Material 3 styling from the design system) ──────────
// Big touch targets (min 44px), visible focus, plain-language labels.

import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

/** Material Symbols glyph. `fill` renders the filled variant used in the designs. */
export function Ico({ name, fill, size, className = '' }: { name: string; fill?: boolean; size?: number | string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined${fill ? ' fill' : ''} ${className}`}
      style={size ? { fontSize: typeof size === 'number' ? `${size}px` : size } : undefined}
    >
      {name}
    </span>
  )
}

/**
 * Medical drug capsule (Streamline Nova, 24×24). Inline SVG so it inherits
 * `currentColor` and sits alongside the Material Symbols set without another
 * font download. Path is the original artwork, fill-only, viewBox preserved.
 */
export function PillIcon({ size = 24, className = '' }: { size?: number | string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.46789 2.46789c3.29051 -3.290521 8.72411 -3.290521 12.01461 0 3.2905 3.29054 3.2905 8.72411 0 12.01461l-7 7c-3.2905 3.2905 -8.72407 3.2905 -12.01461 0 -3.290521 -3.2905 -3.290521 -8.7241 0 -12.01461zM3.88196 10.882c-2.50948 2.5094 -2.50948 6.677 0 9.1865 2.50948 2.5094 6.67704 2.5094 9.18654 0l3.7998 -3.8008 -9.18654 -9.18653zM19.7833 4.16809c-2.0903 -2.09031 -5.5236 -2.08989 -7.6142 0l1.414 1.41406c1.3096 -1.30884 3.4769 -1.30926 4.7862 0z"
      />
    </svg>
  )
}

/**
 * Tab-bar icon from a monochrome PNG in /public/icons, applied as a CSS mask so
 * it inherits `currentColor` (active vs. inactive) and scales without blurring
 * like an <img> would. The source artwork is solid black on transparency.
 */
export function MaskIcon({
  file,
  size = 24,
  className = '',
}: {
  file: string
  size?: number | string
  className?: string
}) {
  const url = `/icons/${file}`
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size,
        WebkitMaskImage: `url(${url})`,
        maskImage: `url(${url})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  )
}

/** Onboarding step indicator (Step X of Y + progress track). */
export function StepProgress({ step, of, label, pct }: { step: number; of: number; label: string; pct: number }) {
  return (
    <section className="mb-space-md flex flex-col gap-space-xs pt-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-label-sm font-semibold uppercase tracking-wider text-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
          Step {step} of {of}
        </span>
        <span className="text-label-sm font-medium text-on-surface-variant">{label}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
        <div className="h-full rounded-full bg-secondary transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </section>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`print-card rounded-xl bg-surface-container-lowest p-4 shadow-sm dark:bg-ink-900 ${className}`}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-headline-md text-on-surface dark:text-ink-100">{children}</h2>
      {sub && <p className="mt-1 text-body-md text-on-surface-variant dark:text-ink-400">{sub}</p>}
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary-container text-on-primary hover:bg-black disabled:bg-surface-container-highest disabled:text-outline',
  secondary: 'bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-60',
  ghost: 'text-secondary hover:bg-surface-container disabled:opacity-60',
  danger: 'bg-error text-on-error hover:bg-danger-700',
  warning: 'bg-warn-600 text-white hover:bg-warn-700',
}

export function Button({
  variant = 'primary', className = '', size = 'md', ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = {
    sm: 'min-h-9 px-3 text-label-sm',
    md: 'min-h-11 px-4 text-label-md',
    lg: 'min-h-12 px-5 text-label-md',
    xl: 'min-h-14 px-6 text-headline-sm',
  }
  return (
    <button
      {...props}
      className={`inline-flex min-w-11 items-center justify-center gap-2 rounded-full font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${sizes[size]} ${VARIANTS[variant]} ${className}`}
    />
  )
}

export function Field({ label, hint, children, required }: { label: string; hint?: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-label-md font-semibold text-on-surface dark:text-ink-100">
        {label} {required && <span aria-hidden="true" className="text-error">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 flex items-center gap-1 text-body-sm text-on-surface-variant dark:text-ink-400">{hint}</span>}
    </label>
  )
}

const inputBase =
  'w-full rounded-xl bg-surface-container-lowest px-3.5 h-12 text-body-lg text-on-surface shadow-sm outline-none transition-all placeholder:text-outline focus:shadow-md dark:bg-ink-800 dark:text-ink-100'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} min-h-24 py-3 ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} appearance-none ${props.className ?? ''}`} />
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="flex-1">
        <label htmlFor={id} className="cursor-pointer text-label-md font-semibold text-on-surface dark:text-ink-100">{label}</label>
        {hint && <p id={`${id}-hint`} className="mt-0.5 text-body-sm text-on-surface-variant dark:text-ink-400">{hint}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full px-0.5 transition-colors ${checked ? 'bg-secondary' : 'bg-surface-container-high dark:bg-ink-700'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full shadow-md transition-transform ${checked ? 'translate-x-5 bg-on-secondary' : 'translate-x-0.5 bg-surface-container-lowest'}`} />
      </button>
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'info' | 'danger' }) {
  const tones = {
    neutral: 'bg-surface-container text-on-surface-variant dark:bg-ink-800 dark:text-ink-300',
    good: 'bg-secondary-container text-on-secondary-container',
    warn: 'bg-warn-100 text-warn-700 dark:bg-warn-900 dark:text-warn-100',
    info: 'bg-tertiary-fixed text-on-tertiary-fixed dark:bg-blue-900/40 dark:text-blue-200',
    danger: 'bg-error-container text-on-error-container',
  }
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-label-sm font-medium ${tones[tone]}`}>{children}</span>
}

export function VerifiedBadge({ verified, label }: { verified: boolean; label?: string }) {
  return verified
    ? <Badge tone="good"><Ico name="verified" fill size={14} />{label ?? 'Verified'}</Badge>
    : <Badge tone="warn">{label ?? 'Unverified'}</Badge>
}

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-surface-container-lowest p-10 text-center shadow-sm dark:bg-ink-900">
      <div aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-full bg-surface-container dark:bg-ink-800">
        <Ico name={icon} size={32} className="text-outline" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-headline-sm text-on-surface dark:text-ink-100">{title}</h3>
        <p className="max-w-xs text-body-md text-on-surface-variant dark:text-ink-400">{body}</p>
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-0 sm:items-center sm:p-6" role="presentation">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`max-h-[90vh] w-full overflow-auto rounded-t-2xl bg-surface-container-lowest p-6 shadow-xl dark:bg-ink-900 sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
      >
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-surface-container pb-3 dark:border-ink-700">
          <h2 className="text-headline-md text-on-surface dark:text-ink-100">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-outline transition-colors hover:bg-surface-container dark:hover:bg-ink-800"
          >
            <Ico name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'danger' | 'good'; title?: string; children: ReactNode }) {
  const tones = {
    info: 'bg-surface-container-low text-on-surface dark:bg-ink-800 dark:text-ink-100',
    warn: 'bg-warn-50 text-warn-900 dark:bg-warn-900/40 dark:text-warn-100',
    danger: 'bg-error-container text-on-error-container dark:bg-red-950 dark:text-red-100',
    good: 'bg-secondary-container/40 text-on-secondary-container dark:bg-teal-950 dark:text-teal-100',
  }
  const icons = { info: 'info', warn: 'priority_high', danger: 'emergency', good: 'verified_user' }
  return (
    <div role="note" className={`flex items-start gap-2.5 rounded-xl p-3.5 text-body-sm ${tones[tone]}`}>
      <Ico name={icons[tone]} size={18} className="mt-0.5 shrink-0" fill={tone !== 'info'} />
      <div className="min-w-0">
        {title && <p className="text-label-md font-semibold">{title}</p>}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
    </div>
  )
}

export function PasswordField({ label, value, onChange, hint, autoComplete }: { label: string; value: string; onChange: (v: string) => void; hint?: string; autoComplete?: string }) {
  const [show, setShow] = useState(false)
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <Input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className="pr-16" />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute inset-y-0 right-2 my-auto flex h-8 items-center gap-1 rounded-lg px-2 text-label-sm font-medium text-secondary hover:bg-surface-container"
        >
          <Ico name={show ? 'visibility_off' : 'visibility'} size={16} />
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </Field>
  )
}
