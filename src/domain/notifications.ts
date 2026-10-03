// ─── Notification generation (local only) ────────────────────────────────────
// Derives calm, actionable notifications from the user's own data. Severity
// uses amber for warnings; RED is reserved for the emergency button.

import type { Appointment, CaregiverGrant, EmergencyContact, EmergencyProfile, Medication, Notification, User } from '@/types'
import { refillAlerts } from './medications'
import { daysUntil, nowIso, uid } from '@/lib/util'
import { EMERGENCY_STALE_AFTER_DAYS } from './emergency'

export type NotifDraft = Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>

export function generateNotificationDrafts(input: {
  user: User
  emergency: EmergencyProfile
  medications: Medication[]
  appointments: Appointment[]
  grants: CaregiverGrant[]
  contacts: EmergencyContact[]
  existing: Notification[]
}): NotifDraft[] {
  const { user, emergency, medications, appointments, grants, contacts, existing } = input
  const drafts: NotifDraft[] = []
  const today = nowIso().slice(0, 10)
  const has = (type: string, key: string) =>
    existing.some((n) => n.type === type && (n.body.includes(key) || n.scheduledFor?.startsWith(today)) && !n.readAt)

  for (const r of refillAlerts(medications)) {
    if (has('refill', r.medicationId)) continue
    drafts.push({
      userId: user.id, type: 'refill', title: 'Refill reminder',
      body: r.message, severity: r.kind === 'supply-empty' ? 'warning' : 'info', scheduledFor: nowIso(),
    })
  }

  const nextAppt = appointments
    .filter((a) => a.status === 'scheduled' && daysUntil(a.datetime) >= 0)
    .sort((a, b) => a.datetime.localeCompare(b.datetime))[0]
  if (nextAppt && daysUntil(nextAppt.datetime) <= 7 && !existing.some((n) => n.type === 'appointment-prep' && n.readAt === undefined && n.body.includes(nextAppt.id))) {
    drafts.push({
      userId: user.id, type: 'appointment-prep', title: 'Prepare for your appointment',
      body: `You have an appointment in ${Math.max(0, daysUntil(nextAppt.datetime))} day(s). Review the pre-visit summary and add your questions.`,
      severity: 'info', scheduledFor: nextAppt.datetime,
    })
  }

  const ageDays = (Date.now() - new Date(emergency.lastUpdatedAt).getTime()) / 86_400_000
  if (ageDays > EMERGENCY_STALE_AFTER_DAYS && !has('emergency-stale', 'emergency')) {
    drafts.push({
      userId: user.id, type: 'emergency-stale', title: 'Emergency profile may be outdated',
      body: `Your emergency profile was last updated more than ${EMERGENCY_STALE_AFTER_DAYS} days ago. Please review it.`,
      severity: 'warning', scheduledFor: nowIso(),
    })
  }

  for (const g of grants) {
    if (g.status === 'active' && g.expiresAt) {
      const d = daysUntil(g.expiresAt)
      if (d <= 7 && d >= 0 && !existing.some((n) => n.type === 'grant-expiry' && !n.readAt && n.body.includes(g.id))) {
        const c = contacts.find((x) => x.id === g.contactId)
        drafts.push({
          userId: user.id, type: 'grant-expiry', title: 'Shared access expiring',
          body: `${c?.name ?? 'A caregiver'}'s access expires ${d === 0 ? 'today' : `in ${d} day(s)`}. You can extend or let it end — no action is taken automatically.`,
          severity: 'info', scheduledFor: nowIso(),
        })
      }
    }
  }

  void uid
  return drafts
}
