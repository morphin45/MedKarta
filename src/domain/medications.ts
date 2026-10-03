// ─── Medication adherence, refill math, and schedule logic ───────────────────
// Pure functions. Guardrails enforced downstream in UI:
//   • Never recommend doubling a missed dose.
//   • Never auto-change schedules.
//   • Medication questions → "ask your clinician or pharmacist."

import type { Medication, MedicationLog } from '@/types'
import { daysUntil } from '@/lib/util'

export interface DoseSlot {
  medicationId: string
  medicationName: string
  time: string // HH:MM
  status: 'taken' | 'skipped' | 'missed' | 'due'
}

export interface RefillAlert {
  medicationId: string
  medicationName: string
  kind: 'supply-low' | 'refill-due' | 'supply-empty'
  message: string
}

export function todayDoseSlots(meds: Medication[], logs: MedicationLog[], now = new Date()): DoseSlot[] {
  const active = meds.filter((m) => m.status === 'active' && !m.deletedAt)
  const today = now.toISOString().slice(0, 10)
  const slots: DoseSlot[] = []
  for (const m of active) {
    for (const t of m.reminderTimes) {
      const log = logs.find((l) => l.medicationId === m.id && l.date === today && l.time === t && !l.deletedAt)
      const nowMinutes = now.getHours() * 60 + now.getMinutes()
      const [h, mm] = t.split(':').map(Number)
      const slotMinutes = (h ?? 0) * 60 + (mm ?? 0)
      let status: DoseSlot['status'] = 'due'
      if (log) status = log.status
      else if (nowMinutes > slotMinutes + 90) status = 'missed'
      slots.push({ medicationId: m.id, medicationName: m.name, time: t, status })
    }
  }
  return slots.sort((a, b) => a.time.localeCompare(b.time))
}

export function adherenceLast7Days(meds: Medication[], logs: MedicationLog[], now = new Date()): { taken: number; scheduled: number; pct: number } {
  const active = meds.filter((m) => !m.deletedAt)
  let scheduled = 0
  let taken = 0
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const day = d.toISOString().slice(0, 10)
    for (const m of active) {
      const started = !m.startDate || new Date(`${m.startDate}T12:00:00`) <= d
      const ended = !m.endDate || new Date(`${m.endDate}T12:00:00`) >= d
      if (!started || !ended) continue
      for (const _t of m.reminderTimes) {
        void _t
        scheduled++
        const log = logs.find((l) => l.medicationId === m.id && l.date === day && !l.deletedAt && l.time === _t)
        if (log?.status === 'taken') taken++
      }
    }
  }
  return { taken, scheduled, pct: scheduled === 0 ? 100 : Math.round((taken / scheduled) * 100) }
}

export function refillAlerts(meds: Medication[]): RefillAlert[] {
  const out: RefillAlert[] = []
  for (const m of meds) {
    if (m.status !== 'active' || m.deletedAt) continue
    if (m.supplyRemaining !== undefined && m.refillQuantity !== undefined) {
      if (m.supplyRemaining <= 0) {
        out.push({ medicationId: m.id, medicationName: m.name, kind: 'supply-empty', message: `${m.name}: no doses left — contact the pharmacy to refill.` })
      } else if (m.supplyRemaining <= Math.max(3, Math.ceil(m.refillQuantity * 0.25))) {
        out.push({ medicationId: m.id, medicationName: m.name, kind: 'supply-low', message: `${m.name}: about ${m.supplyRemaining} doses left — time to arrange a refill.` })
      }
    }
    if (m.refillDueDate) {
      const d = daysUntil(m.refillDueDate)
      if (d <= 5) out.push({ medicationId: m.id, medicationName: m.name, kind: 'refill-due', message: `${m.name}: refill due ${d <= 0 ? 'now' : `in ${d} day${d === 1 ? '' : 's'}`}.` })
    }
  }
  return out
}

/** Missed-dose guidance is deliberately generic and cautious. */
export const MISSED_DOSE_GUIDANCE =
  'If you missed a dose, do not double up. Follow your prescription label, and ask your pharmacist or clinician what to do for this specific medication.'

export const MEDICATION_DISCLAIMER =
  'Personal Health OS organizes the information you enter. It does not provide medical advice, does not check drug interactions, and never changes your medication schedule. For questions about any medication, contact your clinician or pharmacist.'
