// ─── Medication Center ───────────────────────────────────────────────────────
// Strong guardrails: no schedule auto-changes, no doubling advice, no
// interaction conclusions, always points to clinician/pharmacist.

import { useMemo, useState } from 'react'
import { useHealth } from '@/store/useHealth'
import { Badge, Button, Callout, Card, EmptyState, Field, Input, Modal, PillIcon, SectionTitle, Select, Textarea, Toggle } from '@/components/ui'
import type { Medication, MedicationStatus } from '@/types'
import { fmtDate, nowIso, daysUntil, uid } from '@/lib/util'
import { MEDICATION_DISCLAIMER, MISSED_DOSE_GUIDANCE } from '@/domain/medications'
import { findConflictingMedications } from '@/domain/records'

const STATUS_TONE: Record<MedicationStatus, 'good' | 'warn' | 'neutral'> = {
  active: 'good', paused: 'warn', completed: 'neutral', discontinued: 'neutral',
}

const EMPTY_MED: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'> = {
  userId: 'self', name: '', brandName: '', dose: '', form: 'Tablet', purpose: '', instructions: '',
  frequency: 'Once daily', prescriberId: undefined, pharmacy: '', startDate: undefined, endDate: undefined,
  status: 'active', supplyRemaining: undefined, refillQuantity: undefined, refillDueDate: undefined,
  reminderTimes: [], confirmedByClinician: false,
}

export function Medications() {
  const { entities, upsert, softDelete, addMedicationLog, demoMode } = useHealth()
  const [editing, setEditing] = useState<Medication | null>(null)
  const [creating, setCreating] = useState(false)

  const meds = entities.medications.filter((m) => !m.deletedAt)
  const conflicts = useMemo(() => findConflictingMedications(entities.medications), [entities.medications])

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle sub="What you take, when, and how much is left — with refill nudges.">
          <span className="flex items-center gap-2">
            <PillIcon size={24} className="shrink-0 text-secondary" />
            Medication Center
          </span>
        </SectionTitle>
        <Button size="lg" onClick={() => setCreating(true)}>+ Add medication</Button>
      </div>

      {demoMode && <p className="text-xs text-ink-400">Sample data shown.</p>}

      <Callout tone="info" title="Important">
        {MEDICATION_DISCLAIMER}
      </Callout>

      {conflicts.length > 0 && (
        <Callout tone="warn" title="Please review — conflicting entries">
          <ul className="list-disc pl-5">{conflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul>
        </Callout>
      )}

      {meds.length === 0 ? (
        <EmptyState icon="💊" title="No medications yet" body="Add what you take so schedules, refills and your emergency card stay accurate." action={<Button onClick={() => setCreating(true)}>+ Add medication</Button>} />
      ) : (
        <div className="space-y-3">
          {meds.map((m) => {
            const prescriber = entities.doctors.find((d) => d.id === m.prescriberId)
            const today = nowIso().slice(0, 10)
            const todaysLogs = entities.medicationLogs.filter((l) => l.medicationId === m.id && l.date === today && !l.deletedAt)
            return (
              <Card key={m.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold">{m.name}{m.brandName ? ` (${m.brandName})` : ''}</h3>
                      <Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge>
                      {m.confirmedByClinician ? <Badge tone="good">confirmed by clinician</Badge> : <Badge tone="warn">user-entered</Badge>}
                    </div>
                    <p className="mt-1 text-sm"><strong>{m.dose}</strong> · {m.form} · {m.frequency}</p>
                    {m.purpose && <p className="text-sm text-ink-500 dark:text-ink-400">For: {m.purpose}</p>}
                    {m.instructions && <p className="mt-1 text-sm">📋 {m.instructions}</p>}
                    <p className="mt-1 text-xs text-ink-400">
                      {m.startDate && `Started ${fmtDate(m.startDate)}`}
                      {m.endDate && ` · Ended ${fmtDate(m.endDate)}`}
                      {prescriber && ` · Prescriber: ${prescriber.name}`}
                      {m.pharmacy && ` · Pharmacy: ${m.pharmacy}`}
                    </p>
                    {m.supplyRemaining !== undefined && (
                      <p className="mt-1 text-sm">
                        Supply left: <strong>{m.supplyRemaining}</strong>
                        {m.refillDueDate && ` · Refill due ${fmtDate(m.refillDueDate)} (${daysUntil(m.refillDueDate) <= 0 ? 'now' : `in ${daysUntil(m.refillDueDate)}d`})`}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {m.reminderTimes.map((t) => {
                      const log = todaysLogs.find((l) => l.time === t)
                      return (
                        <div key={t} className="flex items-center gap-1 text-sm">
                          <span className="w-12 text-ink-500">{t}</span>
                          {log ? (
                            <Badge tone={log.status === 'taken' ? 'good' : 'neutral'}>{log.status}</Badge>
                          ) : (
                            <>
                              <Button size="sm" onClick={() => void addMedicationLog(m.id, t, 'taken')}>Take</Button>
                              <Button size="sm" variant="ghost" onClick={() => void addMedicationLog(m.id, t, 'skipped')}>Skip</Button>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(m)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => void softDelete('medications', m.id)}>Delete</Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Card>
        <SectionTitle sub={MISSED_DOSE_GUIDANCE}>Missed a dose?</SectionTitle>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          Check it off above only if that matches what actually happened. The app never reschedules anything on its own
          and never suggests taking two doses.
        </p>
      </Card>

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null) }} title={editing ? 'Edit medication' : 'Add medication'} wide>
        <MedForm
          initial={editing ?? undefined}
          onSave={(rec) => { void upsert('medications', rec); setCreating(false); setEditing(null) }}
          onCancel={() => { setCreating(false); setEditing(null) }}
        />
      </Modal>
    </div>
  )
}

function MedForm({ initial, onSave, onCancel }: { initial?: Medication; onSave: (m: Medication) => void; onCancel: () => void }) {
  const { entities } = useHealth()
  const [m, setM] = useState<Partial<Medication>>(initial ?? { ...EMPTY_MED, userId: entities.users[0]?.id ?? 'self' })
  const set = (patch: Partial<Medication>) => setM((s) => ({ ...s, ...patch }))

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        const now = nowIso()
        onSave({
          id: initial?.id ?? uid('med'),
          userId: initial?.userId ?? entities.users[0]?.id ?? 'self',
          name: m.name?.trim() ?? '',
          brandName: m.brandName || undefined,
          dose: m.dose?.trim() ?? '',
          form: m.form ?? 'Tablet',
          purpose: m.purpose || undefined,
          instructions: m.instructions || undefined,
          frequency: m.frequency ?? 'Once daily',
          prescriberId: m.prescriberId || undefined,
          pharmacy: m.pharmacy || undefined,
          startDate: m.startDate || undefined,
          endDate: m.endDate || undefined,
          status: m.status ?? 'active',
          supplyRemaining: m.supplyRemaining,
          refillQuantity: m.refillQuantity,
          refillDueDate: m.refillDueDate || undefined,
          reminderTimes: m.reminderTimes ?? [],
          confirmedByClinician: m.confirmedByClinician ?? false,
          createdAt: initial?.createdAt ?? now, updatedAt: now,
        })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Medication name" required><Input value={m.name ?? ''} onChange={(e) => set({ name: e.target.value })} required placeholder="e.g. Metformin" /></Field>
        <Field label="Brand name (optional)"><Input value={m.brandName ?? ''} onChange={(e) => set({ brandName: e.target.value })} /></Field>
        <Field label="Dosage" required hint="e.g. 500 mg"><Input value={m.dose ?? ''} onChange={(e) => set({ dose: e.target.value })} required /></Field>
        <Field label="Form">
          <Select value={m.form} onChange={(e) => set({ form: e.target.value })}>
            {['Tablet', 'Capsule', 'Liquid', 'Injection', 'Patch', 'Inhaler', 'Cream', 'Other'].map((f) => <option key={f}>{f}</option>)}
          </Select>
        </Field>
        <Field label="Frequency"><Input value={m.frequency ?? ''} onChange={(e) => set({ frequency: e.target.value })} placeholder="Once daily" /></Field>
        <Field label="Status">
          <Select value={m.status} onChange={(e) => set({ status: e.target.value as MedicationStatus })}>
            {(['active', 'paused', 'completed', 'discontinued'] as MedicationStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Start date"><Input type="date" value={m.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value })} /></Field>
        <Field label="End date (if known)"><Input type="date" value={m.endDate ?? ''} onChange={(e) => set({ endDate: e.target.value })} /></Field>
        <Field label="Prescribing clinician">
          <Select value={m.prescriberId ?? ''} onChange={(e) => set({ prescriberId: e.target.value })}>
            <option value="">— None —</option>
            {entities.doctors.filter((d) => !d.deletedAt).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Pharmacy"><Input value={m.pharmacy ?? ''} onChange={(e) => set({ pharmacy: e.target.value })} /></Field>
        <Field label="Doses remaining" hint="For refill reminders"><Input type="number" min={0} value={m.supplyRemaining ?? ''} onChange={(e) => set({ supplyRemaining: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
        <Field label="Refill quantity" hint="How many doses a refill provides"><Input type="number" min={0} value={m.refillQuantity ?? ''} onChange={(e) => set({ refillQuantity: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
        <Field label="Next refill due"><Input type="date" value={m.refillDueDate ?? ''} onChange={(e) => set({ refillDueDate: e.target.value })} /></Field>
      </div>
      <Field label="Reminder times" hint="Add one line per daily time (HH:MM), e.g. 08:00 — the app never changes these by itself.">
        <Textarea value={(m.reminderTimes ?? []).join('\n')} onChange={(e) => set({ reminderTimes: e.target.value.split('\n').map((s) => s.trim()).filter((s) => /^\d{1,2}:\d{2}$/.test(s)) })} placeholder={'08:00\n19:00'} />
      </Field>
      <Field label="Purpose"><Input value={m.purpose ?? ''} onChange={(e) => set({ purpose: e.target.value })} placeholder="e.g. Blood pressure" /></Field>
      <Field label="Instructions"><Textarea value={m.instructions ?? ''} onChange={(e) => set({ instructions: e.target.value })} placeholder="Exactly as on the label" /></Field>
      <Toggle
        checked={m.confirmedByClinician ?? false}
        onChange={(v) => set({ confirmedByClinician: v })}
        label="Confirmed by my clinician"
        hint="Marks this entry as verified on lists and the emergency card."
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save medication</Button>
      </div>
    </form>
  )
}
