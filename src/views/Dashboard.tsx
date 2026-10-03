// ─── Dashboard: calm overview ────────────────────────────────────────────────
// Amber for ordinary warnings; red is reserved for the emergency button.

import { useMemo } from 'react'
import { useHealth } from '@/store/useHealth'
import { Badge, Button, Card, EmptyState, SectionTitle } from '@/components/ui'
import { adherenceLast7Days, refillAlerts, todayDoseSlots } from '@/domain/medications'
import { daysUntil, fmtDate, fmtDateTime } from '@/lib/util'
import { TIMELINE_CATEGORY_LABELS } from '@/types'

export function Dashboard() {
  const { entities, setScreen, addMedicationLog, demoMode, resolveEmergency } = useHealth()
  const user = entities.users[0]
  const now = new Date()

  const nextAppt = useMemo(
    () => entities.appointments
      .filter((a) => a.status === 'scheduled' && daysUntil(a.datetime) >= 0 && !a.deletedAt)
      .sort((a, b) => a.datetime.localeCompare(b.datetime))[0],
    [entities.appointments],
  )
  const doctor = nextAppt ? entities.doctors.find((d) => d.id === nextAppt.doctorId) : undefined
  const slots = useMemo(() => todayDoseSlots(entities.medications, entities.medicationLogs, now), [entities.medications, entities.medicationLogs])
  const adherence = useMemo(() => adherenceLast7Days(entities.medications, entities.medicationLogs, now), [entities.medications, entities.medicationLogs])
  const refills = useMemo(() => refillAlerts(entities.medications), [entities.medications])
  const followUps = entities.appointments.filter((a) => a.status === 'completed' && a.postVisit?.followUpDate && !a.deletedAt)
  const recent = [...entities.timelineEntries].filter((t) => !t.deletedAt).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
  const emergency = resolveEmergency()
  const em = entities.emergencyProfiles[0]

  const completeness = useMemo(() => {
    const checks = [
      !!profile_dob(entities), entities.allergies.some((a) => !a.deletedAt), entities.medications.some((m) => !m.deletedAt),
      entities.emergencyContacts.some((c) => c.isEmergencyContact), !!em && em.includeAllergies && em.includeMedications && em.includeContacts,
      entities.doctors.some((d) => d.isPrimary),
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [entities, em])

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Hello{user?.preferredName ? `, ${user.preferredName}` : ''} 👋</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400">Everything is on this device{demoMode ? ' — showing clearly-labeled sample data' : ''}.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setScreen('emergency-setup')}>Edit emergency profile</Button>
      </div>

      {/* Emergency hero */}
      <button
        onClick={() => setScreen('emergency')}
        className="w-full rounded-3xl bg-danger-600 p-6 text-left text-white shadow-lg transition-colors hover:bg-danger-700 focus-visible:outline-dashed"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-extrabold">🆘 Emergency</p>
            <p className="mt-1 text-sm text-white/85">
              {emergency?.includedSections.length ? `Your profile shares: ${emergency.includedSections.join(', ')}` : 'Open your emergency profile'}
            </p>
          </div>
          <span aria-hidden="true" className="text-4xl">→</span>
        </div>
      </button>

      {em && new Date(em.lastUpdatedAt).getTime() < Date.now() - 180 * 86_400_000 && (
        <CalloutAmber title="Emergency profile may be outdated">Last updated {fmtDate(em.lastUpdatedAt)}. A quick review keeps it trustworthy.</CalloutAmber>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Next appointment */}
        <Card>
          <SectionTitle sub={nextAppt ? fmtDateTime(nextAppt.datetime) : undefined}>Next appointment</SectionTitle>
          {nextAppt ? (
            <div className="space-y-2">
              <p className="font-bold">{nextAppt.reason || 'Check-in'}</p>
              <p className="text-sm text-ink-500 dark:text-ink-400">{doctor?.name ?? 'Provider TBA'}{nextAppt.location ? ` · ${nextAppt.location}` : ''}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" onClick={() => setScreen('visits')}>Prepare for visit</Button>
                {nextAppt.prepSummary && <Badge tone="good">Prep summary ready</Badge>}
              </div>
            </div>
          ) : (
            <EmptyState icon="📅" title="No upcoming appointments" body="Add one from Doctor Visits to build a pre-visit summary." action={<Button size="sm" onClick={() => setScreen('visits')}>Go to visits</Button>} />
          )}
        </Card>

        {/* Today's medications */}
        <Card>
          <SectionTitle sub={slots.length ? `${slots.filter((s) => s.status === 'taken').length} of ${slots.length} doses taken today` : undefined}>
            Today’s medications
          </SectionTitle>
          {slots.length === 0 ? (
            <EmptyState icon="💊" title="No medication reminders today" body="Add medications with reminder times to build a daily schedule." action={<Button size="sm" onClick={() => setScreen('medications')}>Add medication</Button>} />
          ) : (
            <ul className="space-y-2">
              {slots.map((s) => (
                <li key={`${s.medicationId}-${s.time}`} className="flex items-center justify-between gap-2 rounded-xl border border-ink-200 p-2 dark:border-ink-700">
                  <div>
                    <p className="font-semibold">{s.medicationName} <span className="text-ink-400">· {s.time}</span></p>
                    {s.status === 'missed' && <Badge tone="warn">missed — do not double, ask pharmacist</Badge>}
                    {s.status === 'skipped' && <Badge tone="neutral">skipped</Badge>}
                    {s.status === 'due' && <Badge tone="info">due</Badge>}
                  </div>
                  {s.status === 'due' || s.status === 'missed' ? (
                    <Button size="sm" onClick={() => void addMedicationLog(s.medicationId, s.time, 'taken')}>Take</Button>
                  ) : (
                    <Badge tone="good">taken ✓</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 rounded-xl bg-ink-50 p-3 text-sm dark:bg-ink-800">
            <div className="flex justify-between"><span>Adherence last 7 days</span><strong>{adherence.pct}%</strong></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-700">
              <div className="h-full bg-teal-600" style={{ width: `${adherence.pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">A gentle estimate from your check-ins — not a judgment.</p>
          </div>
        </Card>

        {/* Refills */}
        <Card>
          <SectionTitle>Refill & supply</SectionTitle>
          {refills.length === 0 ? (
            <p className="text-sm text-ink-500 dark:text-ink-400">All supplies look okay right now.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {refills.map((r) => (
                <li key={r.medicationId + r.kind} className="flex items-start gap-2 rounded-xl bg-warn-50 p-2 dark:bg-warn-900/30">
                  <span aria-hidden="true">🧴</span>
                  <span>{r.message}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Follow-ups & completeness */}
        <Card>
          <SectionTitle>Follow-ups & tasks</SectionTitle>
          {followUps.length === 0 ? (
            <p className="text-sm text-ink-500 dark:text-ink-400">No pending follow-ups from past visits.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {followUps.map((a) => (
                <li key={a.id}>
                  📌 {a.postVisit?.followUpDate && `Follow up by ${fmtDate(a.postVisit.followUpDate)}`} — {a.reason}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 border-t border-ink-100 pt-3 dark:border-ink-800">
            <div className="flex justify-between text-sm"><span>Profile completeness</span><strong>{completeness}%</strong></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-700">
              <div className="h-full bg-teal-600" style={{ width: `${completeness}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Complete profiles make emergency cards far more useful.</p>
          </div>
        </Card>
      </div>

      {/* Recent timeline */}
      <Card>
        <SectionTitle sub="Latest entries in your Medical Memory">Recent health activity</SectionTitle>
        {recent.length === 0 ? (
          <EmptyState icon="🧠" title="Your medical memory is empty" body="Add events, symptoms, labs and visits to build your timeline." action={<Button size="sm" onClick={() => setScreen('memory')}>Open Medical Memory</Button>} />
        ) : (
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span><strong>{t.title}</strong> <span className="text-ink-400">· {TIMELINE_CATEGORY_LABELS[t.category]}</span></span>
                <span className="shrink-0 text-ink-400">{fmtDate(t.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function profile_dob(e: ReturnType<typeof useHealth.getState>['entities']): string | undefined {
  return e.userProfiles[0]?.dateOfBirth
}

function CalloutAmber({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="note" className="rounded-xl border border-warn-100 bg-warn-50 p-3 text-sm text-warn-900 dark:bg-warn-900/40 dark:text-warn-100 dark:border-warn-700">
      <p className="font-bold">{title}</p>
      <div>{children}</div>
    </div>
  )
}
