// ─── Record hygiene: duplicates & conflicting medication records ─────────────
// Edge cases from the spec: duplicate records and conflicting medication
// entries are surfaced for the user to resolve — never auto-merged.

import type { Medication, TimelineEntry } from '@/types'

export interface DuplicateSuggestion {
  kind: 'medication' | 'timeline'
  ids: [string, string]
  message: string
}

export function findDuplicateMedications(meds: Medication[]): DuplicateSuggestion[] {
  const active = meds.filter((m) => !m.deletedAt)
  const out: DuplicateSuggestion[] = []
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!
      const b = active[j]!
      const nameA = a.name.trim().toLowerCase()
      const nameB = b.name.trim().toLowerCase()
      if (nameA && nameA === nameB && a.status === 'active' && b.status === 'active') {
        out.push({
          kind: 'medication',
          ids: [a.id, b.id],
          message: `Two active entries for “${a.name}” (${a.dose} and ${b.dose}). Keep one, or pause one to avoid double reminders.`,
        })
      }
    }
  }
  return out
}

export function findSimilarTimelineEntries(entries: TimelineEntry[]): DuplicateSuggestion[] {
  const live = entries.filter((t) => !t.deletedAt)
  const out: DuplicateSuggestion[] = []
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i]!
      const b = live[j]!
      if (a.category === b.category && a.title.trim().toLowerCase() === b.title.trim().toLowerCase() && a.date === b.date) {
        out.push({
          kind: 'timeline',
          ids: [a.id, b.id],
          message: `Possible duplicate: “${a.title}” (${a.date}, ${a.category}).`,
        })
      }
    }
  }
  return out
}

/** Two active entries for the same medication name with different doses. */
export function findConflictingMedications(meds: Medication[]): DuplicateSuggestion[] {
  const active = meds.filter((m) => m.status === 'active' && !m.deletedAt)
  const byName = new Map<string, Medication[]>()
  for (const m of active) {
    const key = m.name.trim().toLowerCase()
    byName.set(key, [...(byName.get(key) ?? []), m])
  }
  const out: DuplicateSuggestion[] = []
  for (const [, group] of byName) {
    if (group.length < 2) continue
    const doses = new Set(group.map((m) => m.dose.trim().toLowerCase()))
    if (doses.size > 1) {
      out.push({
        kind: 'medication',
        ids: [group[0]!.id, group[1]!.id],
        message: `Conflicting doses recorded for “${group[0]!.name}”: ${group.map((m) => m.dose).join(' vs ')}. Confirm with your pharmacist which is current.`,
      })
    }
  }
  return out
}
