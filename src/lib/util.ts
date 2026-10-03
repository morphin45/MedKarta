export function uid(prefix = 'r'): string {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  return `${prefix}_${rand}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function fmtDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function daysUntil(iso: string): number {
  const target = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  const now = new Date()
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000)
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function ageFromDob(dob?: string): string {
  if (!dob) return ''
  const d = new Date(`${dob}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  const years = (Date.now() - d.getTime()) / 3.15576e10
  return `${Math.floor(years)}`
}

export function downloadFile(filename: string, content: string, mime = 'application/json'): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
