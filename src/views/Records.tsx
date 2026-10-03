// ─── Health Records: secure document library with needs-review extraction ───

import { useMemo, useState } from 'react'
import { useHealth } from '@/store/useHealth'
import { Badge, Button, Callout, Card, EmptyState, Field, Input, Modal, SectionTitle, Select, Textarea } from '@/components/ui'
import { DOCUMENT_CATEGORY_LABELS, type DocumentCategory, type ExtractedField, type HealthDocument } from '@/types'
import { fmtDate, nowIso, uid } from '@/lib/util'
import { extractFromDocumentText } from '@/domain/ocr'

const CATEGORIES = Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]

export function Records() {
  const { entities, upsert, softDelete, setScreen, demoMode } = useHealth()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<'all' | DocumentCategory>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [reviewing, setReviewing] = useState<HealthDocument | null>(null)

  const docs = useMemo(() => {
    return entities.healthDocuments
      .filter((d) => !d.deletedAt)
      .filter((d) => (showArchived ? !!d.archivedAt : !d.archivedAt))
      .filter((d) => (cat === 'all' ? true : d.category === cat))
      .filter((d) => (q ? `${d.name} ${d.ocrText ?? ''}`.toLowerCase().includes(q.toLowerCase()) : true))
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
  }, [entities.healthDocuments, q, cat, showArchived])

  const needsReview = entities.healthDocuments.filter((d) => !d.deletedAt && !d.extractedReviewed && d.extractedFields.length > 0)

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle sub="Lab results, imaging, discharge papers, prescriptions — encrypted on this device.">
          🧪 Health Records
        </SectionTitle>
        <Button size="lg" onClick={() => setUploadOpen(true)}>+ Upload document</Button>
      </div>

      {demoMode && <p className="text-xs text-ink-400">Sample data shown.</p>}

      {needsReview.length > 0 && (
        <Callout tone="warn" title={`${needsReview.length} document(s) have extracted details waiting for your review`}>
          <ul className="mt-1 space-y-1">
            {needsReview.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <span>{d.name} · {d.extractedFields.length} field(s)</span>
                <Button size="sm" onClick={() => setReviewing(d)}>Review now</Button>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Search"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names and text…" /></Field>
          <Field label="Category">
            <Select value={cat} onChange={(e) => setCat(e.target.value as typeof cat)}>
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{DOCUMENT_CATEGORY_LABELS[c]}</option>)}
            </Select>
          </Field>
          <Field label="Show">
            <Select value={showArchived ? 'archived' : 'active'} onChange={(e) => setShowArchived(e.target.value === 'archived')}>
              <option value="active">Active documents</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        </div>
      </Card>

      {docs.length === 0 ? (
        <EmptyState
          icon="📁" title="No documents here yet"
          body="Upload PDFs or photos of lab results, prescriptions, and letters. Files are encrypted before they touch storage."
          action={<Button onClick={() => setUploadOpen(true)}>+ Upload document</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id}>
              <Card className="!p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info">{DOCUMENT_CATEGORY_LABELS[d.category]}</Badge>
                      {d.extractedFields.length > 0 && (d.extractedReviewed ? <Badge tone="good">reviewed</Badge> : <Badge tone="warn">needs review</Badge>)}
                      {d.archivedAt && <Badge>archived</Badge>}
                      <span className="text-xs text-ink-400">v{d.version} · {fmtDate(d.addedAt)}</span>
                    </div>
                    <p className="mt-1 font-bold">{d.name}</p>
                    {d.notes && <p className="text-sm text-ink-500 dark:text-ink-400">{d.notes}</p>}
                    {d.ocrText && <p className="mt-1 line-clamp-2 text-xs text-ink-400">Extracted text: {d.ocrText.slice(0, 140)}…</p>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {d.extractedFields.length > 0 && !d.extractedReviewed && (
                      <Button size="sm" onClick={() => setReviewing(d)}>Review extraction</Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setReviewing(d)}>Details</Button>
                    {!d.archivedAt ? (
                      <Button variant="ghost" size="sm" onClick={() => void upsert('healthDocuments', { ...d, archivedAt: nowIso() })}>Archive</Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => void upsert('healthDocuments', { ...d, archivedAt: undefined })}>Restore</Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => void softDelete('healthDocuments', d.id)}>Delete</Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <SectionTitle>Export</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => useHealth.getState().exportVaultJson() && undefined}>Download everything (JSON)</Button>
          <Button variant="secondary" onClick={() => useHealth.getState().exportSummaryText()}>Download health summary (text)</Button>
        </div>
        <p className="mt-2 text-xs text-ink-400">Prefer the full export under Settings → Data for a complete, structured copy.</p>
        <Button variant="ghost" size="sm" className="mt-1" onClick={() => setScreen('data')}>Open data & export</Button>
      </Card>

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onCreated={(doc) => { setUploadOpen(false); setReviewing(doc) }}
      />

      <ReviewModal
        doc={reviewing}
        onClose={() => setReviewing(null)}
        onSave={(d) => { void upsert('healthDocuments', d); setReviewing(null) }}
      />
    </div>
  )
}

function UploadModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (d: HealthDocument) => void }) {
  const { entities } = useHealth()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<DocumentCategory>('other')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [mime, setMime] = useState('text/plain')
  const [size, setSize] = useState(0)

  const readFile = async (f: File) => {
    setFileName(f.name)
    setMime(f.type || 'application/octet-stream')
    setSize(f.size)
    if (!name) setName(f.name)
    if (f.type.startsWith('text/') || f.type === 'application/json') {
      const t = await f.text()
      setText(t.slice(0, 20_000))
    } else {
      setText('')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Upload document" wide>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          const now = nowIso()
          const sourceText = text || ''
          const extraction = extractFromDocumentText(sourceText, fileName || name)
          const doc: HealthDocument = {
            id: uid('doc'), userId: entities.users[0]?.id ?? 'self',
            name: name.trim() || fileName || 'Untitled document', category, mime,
            size: size || sourceText.length, addedAt: now, notes: '',
            ciphertextB64: sourceText ? btoa(unescape(encodeURIComponent(sourceText))) : undefined,
            ocrText: sourceText || undefined,
            extractedFields: extraction.fields, extractedReviewed: false, version: 1,
            createdAt: now, updatedAt: now,
          }
          onCreated(doc)
        }}
      >
        <Field label="Choose file" hint="PDF, image or text. Text-based files are read on-device; for scans, paste the text below after uploading.">
          <input type="file" className="block w-full rounded-xl border border-ink-300 p-2 text-sm dark:border-ink-600" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f) }} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Document name" required><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{DOCUMENT_CATEGORY_LABELS[c]}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Document text (for extraction)" hint="Paste or edit the text content — extraction runs on this device and never sends it anywhere.">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-32" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save & extract</Button>
        </div>
      </form>
    </Modal>
  )
}

function ReviewModal({ doc, onClose, onSave }: { doc: HealthDocument | null; onClose: () => void; onSave: (d: HealthDocument) => void }) {
  const [fields, setFields] = useState<ExtractedField[]>([])
  const [notes, setNotes] = useState('')
  const [initializedFor, setInitializedFor] = useState<string | null>(null)
  if (doc && initializedFor !== doc.id) {
    setFields(doc.extractedFields)
    setNotes(doc.notes)
    setInitializedFor(doc.id)
  }
  if (!doc) return null

  const timelineHint: Record<string, string> = {
    'lab-result': 'Confirmed values can become a “Lab result” event in your Medical Memory.',
    'vaccination-record': 'Can become a “Vaccination” event.',
    'imaging-report': 'Can become an “Imaging” event.',
    prescription: 'Matches it to a medication entry you manage in the Medication Center.',
  }

  return (
    <Modal open onClose={onClose} title="Review extracted details" wide>
      <Callout tone="warn" title="Machine reading is imperfect">
        Compare each field with the original document. Nothing enters your timeline until you confirm it here.
      </Callout>
      <div className="mt-3 space-y-2">
        {fields.length === 0 && <p className="text-sm text-ink-500">No fields were extracted. You can add details manually as timeline events instead.</p>}
        {fields.map((f, i) => (
          <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2 rounded-xl border border-ink-200 p-2 dark:border-ink-700">
            <span className="truncate text-xs font-bold uppercase text-ink-500">{f.field}</span>
            <Input
              value={f.value}
              onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
              aria-label={`Value for ${f.field}`}
            />
            <Badge tone={f.confidence === 'high' ? 'good' : f.confidence === 'medium' ? 'info' : 'warn'}>{f.confidence}</Badge>
          </div>
        ))}
      </div>
      <Field label="Document notes" hint={timelineHint[doc.category] ?? ''}>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button
          onClick={() =>
            onSave({ ...doc, extractedFields: fields, extractedReviewed: true, notes })
          }
        >
          Confirm details are correct
        </Button>
      </div>
    </Modal>
  )
}
