// ─── Medical Memory: chronological, searchable timeline ──────────────────────

import { useMemo, useState } from 'react'
import { useHealth } from '@/store/useHealth'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, SectionTitle, Select, Textarea, VerifiedBadge } from '@/components/ui'
import { TIMELINE_CATEGORY_LABELS, type TimelineCategory, type TimelineEntry } from '@/types'
import { fmtDate, nowIso, todayIso, uid } from '@/lib/util'
import { findDuplicateMedications, findSimilarTimelineEntries } from '@/domain/records'

const CATEGORIES = Object.keys(TIMELINE_CATEGORY_LABELS) as TimelineCategory[]

export function Memory() {
  const { entities, upsert, softDelete, demoMode } = useHealth()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<'all' | TimelineCategory>('all')
  const [verification, setVerification] = useState<'all' | 'verified' | 'user-entered' | 'needs-review'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [editing, setEditing] = useState<TimelineEntry | null>(null)
  const [creating, setCreating] = useState(false)

  const entries = useMemo(() => {
    return entities.timelineEntries
      .filter((t) => !t.deletedAt)
      .filter((t) => (cat === 'all' ? true : t.category === cat))
      .filter((t) => (verification === 'all' ? true : t.verificationStatus === verification))
      .filter((t) => (from ? t.date >= from : true))
      .filter((t) => (to ? t.date <= to : true))
      .filter((t) => (q ? `${t.title} ${t.notes} ${t.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase()) : true))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [entities.timelineEntries, q, cat, verification, from, to])

  const dupMeds = findDuplicateMedications(entities.medications)
  const dupTimeline = findSimilarTimelineEntries(entities.timelineEntries)
  const dupes = [...dupMeds, ...dupTimeline]

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle sub="Everything you or your clinicians recorded, in one place. Plain-language labels, always dated.">
          🧠 Medical Memory
        </SectionTitle>
        <Button size="lg" onClick={() => setCreating(true)}>+ Add health event</Button>
      </div>

      {demoMode && <p className="text-xs text-ink-400">Sample data — entries below are examples, clearly marked in the record source.</p>}

      {dupes.length > 0 && (
        <Card>
          <p className="text-sm font-bold">🔎 Possible duplicates or conflicts</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-600 dark:text-ink-300">
            {dupes.map((d, i) => <li key={i}>{d.message}</li>)}
          </ul>
          <p className="mt-1 text-xs text-ink-400">Review them in Medications or below — nothing is merged automatically.</p>
        </Card>
      )}

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Search"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, notes, tags…" /></Field>
          <Field label="Category">
            <Select value={cat} onChange={(e) => setCat(e.target.value as typeof cat)}>
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{TIMELINE_CATEGORY_LABELS[c]}</option>)}
            </Select>
          </Field>
          <Field label="Verification">
            <Select value={verification} onChange={(e) => setVerification(e.target.value as typeof verification)}>
              <option value="all">All</option>
              <option value="verified">Verified</option>
              <option value="user-entered">User-entered</option>
              <option value="needs-review">Needs review</option>
            </Select>
          </Field>
          <Field label="From date"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To date"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
      </Card>

      {entries.length === 0 ? (
        <EmptyState
          icon="🧠" title="No matching events"
          body={entities.timelineEntries.length === 0 ? 'Your timeline is empty. Add your first health event to start your medical memory.' : 'Try clearing filters or searching for something else.'}
          action={<Button onClick={() => setCreating(true)}>+ Add health event</Button>}
        />
      ) : (
        <ol className="space-y-2">
          {entries.map((t) => (
            <li key={t.id}>
              <Card className="!p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info">{TIMELINE_CATEGORY_LABELS[t.category]}</Badge>
                      <VerifiedBadge verified={t.verificationStatus === 'verified'} label={t.verificationStatus === 'verified' ? 'Verified' : t.verificationStatus === 'needs-review' ? 'Needs review' : 'User-entered'} />
                      {t.tags.map((tag) => <Badge key={tag}>#{tag}</Badge>)}
                    </div>
                    <p className="mt-1 font-bold">{t.title}</p>
                    <p className="text-sm text-ink-500 dark:text-ink-400">{fmtDate(t.date)}{t.source ? ` · Source: ${t.source}` : ''}</p>
                    {t.notes && <p className="mt-1 text-sm">{t.notes}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => void softDelete('timelineEntries', t.id)}>Delete</Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null) }} title={editing ? 'Edit health event' : 'Add health event'} wide>
        <TimelineForm
          initial={editing ?? undefined}
          onSave={(rec) => {
            void upsert('timelineEntries', rec)
            setCreating(false)
            setEditing(null)
          }}
          onCancel={() => { setCreating(false); setEditing(null) }}
        />
      </Modal>
    </div>
  )
}

function TimelineForm({ initial, onSave, onCancel }: { initial?: TimelineEntry; onSave: (t: TimelineEntry) => void; onCancel: () => void }) {
  const { entities } = useHealth()
  const [category, setCategory] = useState<TimelineCategory>(initial?.category ?? 'note')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [providerId, setProviderId] = useState(initial?.providerId ?? '')
  const [facilityId, setFacilityId] = useState(initial?.facilityId ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '')
  const [source, setSource] = useState(initial?.source ?? 'Entered by me')
  const [verificationStatus, setVerificationStatus] = useState(initial?.verificationStatus ?? 'user-entered')

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        const now = nowIso()
        onSave({
          id: initial?.id ?? uid('tl'), userId: initial?.userId ?? entities.users[0]?.id ?? 'self',
          category, title, date, providerId: providerId || undefined, facilityId: facilityId || undefined,
          notes, tags: tags.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean), source,
          verificationStatus, relatedIds: initial?.relatedIds ?? [],
          createdAt: initial?.createdAt ?? now, updatedAt: now,
        })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category" required>
          <Select value={category} onChange={(e) => setCategory(e.target.value as TimelineCategory)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{TIMELINE_CATEGORY_LABELS[c]}</option>)}
          </Select>
        </Field>
        <Field label="Date" required><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
      </div>
      <Field label="Title" required><Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Blood test at Riverbend" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Healthcare provider">
          <Select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            <option value="">— None —</option>
            {entities.doctors.filter((d) => !d.deletedAt).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Facility">
          <Select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
            <option value="">— None —</option>
            {entities.facilities.filter((f) => !f.deletedAt).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What happened, in your own words…" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tags" hint="Comma-separated. Add 'question' to surface it in visit prep.">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="diabetes, question" />
        </Field>
        <Field label="Source">
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            <option>Entered by me</option>
            <option>Patient portal</option>
            <option>Uploaded document</option>
            <option>Clinician told me</option>
            <option>Other</option>
          </Select>
        </Field>
      </div>
      <Field label="Verification status" hint="Only mark 'Verified' if a clinician or official record confirms it.">
        <Select value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value as TimelineEntry['verificationStatus'])}>
          <option value="user-entered">User-entered</option>
          <option value="verified">Verified (clinician/document)</option>
          <option value="needs-review">Needs review</option>
        </Select>
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save event</Button>
      </div>
    </form>
  )
}
