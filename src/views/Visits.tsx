// ─── Doctor Visits: preparation + post-visit instructions ────────────────────

import { useMemo, useState } from 'react'
import { useHealth } from '@/store/useHealth'
import { Badge, Button, Callout, Card, EmptyState, Field, Input, Modal, SectionTitle, Select, Textarea } from '@/components/ui'
import type { Appointment } from '@/types'
import { daysUntil, fmtDateTime, nowIso, uid } from '@/lib/util'
import { SUMMARY_DISCLAIMER } from '@/domain/visits'

export function Visits() {
  const { entities, upsert, demoMode } = useHealth()
  const [creating, setCreating] = useState(false)
  // Store ids, not snapshots: the modal must re-read the live record so a
  // freshly generated summary appears immediately.
  const [preppingId, setPreppingId] = useState<string | null>(null)
  const [postingId, setPostingId] = useState<string | null>(null)

  const upcoming = useMemo(
    () => entities.appointments
      .filter((a) => a.status === 'scheduled' && !a.deletedAt && daysUntil(a.datetime) >= 0)
      .sort((a, b) => a.datetime.localeCompare(b.datetime)),
    [entities.appointments],
  )
  const past = useMemo(
    () => entities.appointments
      .filter((a) => (a.status !== 'scheduled' || daysUntil(a.datetime) < 0) && !a.deletedAt)
      .sort((a, b) => b.datetime.localeCompare(a.datetime)),
    [entities.appointments],
  )

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle sub="Walk in prepared, walk out with clear instructions.">
          🩺 Doctor Visits
        </SectionTitle>
        <Button size="lg" onClick={() => setCreating(true)}>+ Add appointment</Button>
      </div>

      {demoMode && <p className="text-xs text-ink-400">Sample data shown.</p>}

      <SectionTitle sub="Preparation summaries are built only from your own entries and are always labeled as such.">Upcoming</SectionTitle>
      {upcoming.length === 0 ? (
        <EmptyState icon="📅" title="No upcoming appointments" body="Add your next appointment and build a preparation summary from your symptoms, medications and questions." action={<Button onClick={() => setCreating(true)}>+ Add appointment</Button>} />
      ) : (
        <ul className="space-y-2">
          {upcoming.map((a) => {
            const doctor = entities.doctors.find((d) => d.id === a.doctorId)
            const d = daysUntil(a.datetime)
            return (
              <li key={a.id}>
                <Card className="!p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={d <= 2 ? 'warn' : 'info'}>{d === 0 ? 'Today' : `in ${d} day${d === 1 ? '' : 's'}`}</Badge>
                        <p className="font-bold">{a.reason || 'Check-in'}</p>
                      </div>
                      <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
                        {fmtDateTime(a.datetime)}{doctor ? ` · ${doctor.name}` : ''}{a.location ? ` · ${a.location}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => setPreppingId(a.id)}>Prepare</Button>
                      <Button variant="ghost" onClick={() => setPostingId(a.id)}>Record visit outcome</Button>
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <SectionTitle>Past visits</SectionTitle>
      {past.length === 0 ? (
        <p className="text-sm text-ink-500 dark:text-ink-400">No past visits recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {past.map((a) => {
            const doctor = entities.doctors.find((d) => d.id === a.doctorId)
            return (
              <li key={a.id}>
                <Card className="!p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{a.status}</Badge>
                        <p className="font-bold">{a.reason || 'Visit'}</p>
                      </div>
                      <p className="text-sm text-ink-500 dark:text-ink-400">{fmtDateTime(a.datetime)}{doctor ? ` · ${doctor.name}` : ''}</p>
                      {a.postVisit?.instructions && <p className="mt-1 text-sm">📋 {a.postVisit.instructions}</p>}
                      {a.postVisit?.followUpDate && <p className="text-sm text-ink-500">📌 Follow up by {fmtDateTime(a.postVisit.followUpDate)}</p>}
                    </div>
                    <div className="flex gap-1">
                      {!a.postVisit && <Button variant="ghost" size="sm" onClick={() => setPostingId(a.id)}>Record outcome</Button>}
                      {a.postVisit && <Button variant="ghost" size="sm" onClick={() => setPostingId(a.id)}>View / edit</Button>}
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <AppointmentModal open={creating} onClose={() => setCreating(false)} />
      <PrepModal appointmentId={preppingId} onClose={() => setPreppingId(null)} />
      <PostVisitModal appointmentId={postingId} onClose={() => setPostingId(null)} onSave={(a) => { void upsert('appointments', a); setPostingId(null) }} />
    </div>
  )
}

function AppointmentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { entities, upsert } = useHealth()
  const [doctorId, setDoctorId] = useState('')
  const [datetime, setDatetime] = useState('')
  const [reason, setReason] = useState('')
  const [location, setLocation] = useState('')

  return (
    <Modal open={open} onClose={onClose} title="Add appointment">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          const now = nowIso()
          void upsert('appointments', {
            id: uid('appt'), userId: entities.users[0]?.id ?? 'self',
            doctorId: doctorId || undefined, datetime: new Date(datetime).toISOString(),
            reason, status: 'scheduled', location: location || undefined,
            createdAt: now, updatedAt: now,
          } satisfies Appointment)
          onClose()
        }}
      >
        <Field label="Provider">
          <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">— Choose —</option>
            {entities.doctors.filter((d) => !d.deletedAt).map((d) => <option key={d.id} value={d.id}>{d.name}{d.specialty ? ` (${d.specialty})` : ''}</option>)}
          </Select>
        </Field>
        <Field label="Date & time" required><Input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} required /></Field>
        <Field label="Reason" required><Input value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="e.g. 3-month diabetes review" /></Field>
        <Field label="Location"><Input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save appointment</Button>
        </div>
      </form>
    </Modal>
  )
}

function PrepModal({ appointmentId, onClose }: { appointmentId: string | null; onClose: () => void }) {
  const appt = useHealth((s) => s.entities.appointments.find((a) => a.id === appointmentId))
  const doctor = useHealth((s) => s.entities.doctors.find((d) => d.id === appt?.doctorId))
  const generatePrepSummary = useHealth((s) => s.generatePrepSummary)
  const [goals, setGoals] = useState('')
  const [initializedFor, setInitializedFor] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  if (appt && initializedFor !== appt.id) {
    setGoals(appt.prepGoals ?? '')
    setInitializedFor(appt.id)
  }
  if (!appt) return null

  return (
    <Modal open onClose={onClose} title="Pre-visit summary" wide>
      <Callout tone="info" title={SUMMARY_DISCLAIMER}>
        {appt.prepSummary
          ? `Generated ${fmtDateTime(appt.prepSummary.generatedAt)} from ${appt.prepSummary.sourceIds.length} of your records. Review for accuracy.`
          : 'Builds a summary from your symptoms, medications, allergies, history and questions — nothing is invented.'}
      </Callout>
      {appt.prepSummary && (
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-ink-50 p-3 text-sm dark:bg-ink-800">{appt.prepSummary.text}</pre>
      )}
      <Field label="My goals for this appointment" hint="Saved with this appointment and included in the summary below.">
        <Textarea value={goals} onChange={(e) => setGoals(e.target.value)} placeholder={'e.g. Understand my latest A1c\nAsk about dizziness'} />
      </Field>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button
          disabled={working}
          onClick={async () => {
            setWorking(true)
            await generatePrepSummary(appt.id, goals)
            setWorking(false)
          }}
        >
          {working ? 'Generating…' : appt.prepSummary ? 'Save goals & regenerate' : 'Generate summary'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink-400">Provider: {doctor?.name ?? '—'} · {fmtDateTime(appt.datetime)}</p>
    </Modal>
  )
}

function PostVisitModal({ appointmentId, onClose, onSave }: { appointmentId: string | null; onClose: () => void; onSave: (a: Appointment) => void }) {
  const appt = useHealth((s) => s.entities.appointments.find((a) => a.id === appointmentId))
  const [p, setP] = useState(appt?.postVisit)
  const [followUp, setFollowUp] = useState(appt?.postVisit?.followUpDate?.slice(0, 10) ?? '')
  if (!appt) return null
  const set = (patch: Partial<NonNullable<Appointment['postVisit']>>) => setP((s) => ({ summary: '', instructions: '', medicationChanges: '', testsOrdered: '', referrals: '', openQuestions: '', documentIds: [], recordedAt: nowIso(), ...s, ...patch }))

  return (
    <Modal open onClose={onClose} title="Post-visit instructions" wide>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          onSave({
            ...appt,
            status: 'completed',
            postVisit: {
              summary: p?.summary ?? '', instructions: p?.instructions ?? '',
              medicationChanges: p?.medicationChanges ?? '', testsOrdered: p?.testsOrdered ?? '',
              referrals: p?.referrals ?? '', openQuestions: p?.openQuestions ?? '',
              followUpDate: followUp ? new Date(`${followUp}T12:00:00`).toISOString() : undefined,
              documentIds: p?.documentIds ?? [], recordedAt: nowIso(),
            },
          })
        }}
      >
        <Field label="What did the clinician say?" required><Textarea value={p?.summary ?? ''} onChange={(e) => set({ summary: e.target.value })} required /></Field>
        <Field label="Instructions" hint="Exactly what you were told to do"><Textarea value={p?.instructions ?? ''} onChange={(e) => set({ instructions: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Medication changes"><Textarea value={p?.medicationChanges ?? ''} onChange={(e) => set({ medicationChanges: e.target.value })} placeholder="Started / stopped / changed…" /></Field>
          <Field label="Tests ordered"><Textarea value={p?.testsOrdered ?? ''} onChange={(e) => set({ testsOrdered: e.target.value })} /></Field>
          <Field label="Referrals"><Input value={p?.referrals ?? ''} onChange={(e) => set({ referrals: e.target.value })} /></Field>
          <Field label="Follow-up date"><Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></Field>
        </div>
        <Field label="Questions still unanswered"><Textarea value={p?.openQuestions ?? ''} onChange={(e) => set({ openQuestions: e.target.value })} /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save visit record</Button>
        </div>
      </form>
    </Modal>
  )
}
