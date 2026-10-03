// ─── Data export & personal health summary ───────────────────────────────────
// Export is user-initiated, local, and complete. The health summary is a
// human-readable text digest of everything the user stored.

import type { VaultSnapshot } from '@/types'
import { fmtDate } from '@/lib/util'

export interface EntityMap {
  users: unknown[]
  [k: string]: unknown[]
}

export function buildVaultSnapshot(entities: EntityMap): VaultSnapshot {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    appName: 'personal-health-os',
    data: entities as unknown as Record<string, unknown[]>,
  }
}

export function buildHealthSummaryText(e: EntityMap): string {
  const L: string[] = []
  const push = (s = '') => L.push(s)
  const user = (e.users?.[0] ?? {}) as { name?: string; preferredName?: string }
  const profile = (e.userProfiles?.[0] ?? {}) as { dateOfBirth?: string; bloodType?: string; bloodTypeVerified?: boolean }
  push('PERSONAL HEALTH SUMMARY')
  push(`Prepared ${fmtDate(new Date().toISOString())} by Personal Health OS from the user's own entries.`)
  push('This document reflects user-entered information and may be incomplete or outdated.')
  push()
  push(`Name: ${user.name ?? '—'}${user.preferredName ? ` (prefers ${user.preferredName})` : ''}`)
  if (profile.dateOfBirth) push(`Date of birth: ${fmtDate(profile.dateOfBirth)}`)
  if (profile.bloodTypeVerified && profile.bloodType) push(`Blood type: ${profile.bloodType} (verified)`)
  else if (profile.bloodType) push(`Blood type: ${profile.bloodType} (NOT verified — confirm with a clinician)`)
  push()

  const sec = (title: string, rows: Array<[string, string]>) => {
    push(title)
    if (rows.length === 0) push('  (none recorded)')
    for (const [k, v] of rows) push(`  • ${k}${v ? `: ${v}` : ''}`)
    push()
  }

  const ver = (v: unknown) => (v === true ? 'verified' : v === false ? 'unverified' : '')

  const allergies = (e.allergies ?? []) as Array<{ substance: string; reaction?: string; severity: string; verified: boolean; deletedAt?: string }>
  sec('ALLERGIES', allergies.filter((a) => !a.deletedAt).map((a) => [a.substance, `${a.reaction ?? ''} [${a.severity}] ${ver(a.verified)}`.trim()]))

  const conditions = (e.medicalConditions ?? []) as Array<{ name: string; status: string; verified: boolean; deletedAt?: string }>
  sec('CONDITIONS', conditions.filter((c) => !c.deletedAt).map((c) => [c.name, `${c.status} ${ver(c.verified)}`.trim()]))

  const meds = (e.medications ?? []) as Array<{ name: string; dose: string; frequency: string; status: string; confirmedByClinician: boolean; deletedAt?: string }>
  sec('MEDICATIONS', meds.filter((m) => !m.deletedAt).map((m) => [`${m.name} ${m.dose}`, `${m.frequency} [${m.status}]${m.confirmedByClinician ? ' confirmed-by-clinician' : ''}`]))

  const timeline = (e.timelineEntries ?? []) as Array<{ category: string; title: string; date: string; verificationStatus: string; deletedAt?: string }>
  const sorted = [...timeline].filter((t) => !t.deletedAt).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40)
  sec('TIMELINE (most recent 40 events)', sorted.map((t) => [t.title, `${t.date} [${t.category}] ${t.verificationStatus}`]))

  const docs = (e.healthDocuments ?? []) as Array<{ name: string; category: string; archivedAt?: string; deletedAt?: string }>
  sec('DOCUMENTS', docs.filter((d) => !d.deletedAt).map((d) => [d.name, d.archivedAt ? 'archived' : d.category]))

  push('Prepared from user-entered data. Verify critical items (allergies, medications, blood type) with a clinician.')
  return L.join('\n')
}
