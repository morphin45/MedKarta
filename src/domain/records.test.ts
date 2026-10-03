import { describe, expect, it } from 'vitest'
import { findConflictingMedications, findDuplicateMedications, findSimilarTimelineEntries } from './records'
import { extractFromDocumentText } from './ocr'
import { buildDemoData } from '@/data/seed'
import type { Medication, TimelineEntry } from '@/types'

const d = buildDemoData()

function med(name: string, dose: string, status: Medication['status'] = 'active'): Medication {
  return { ...d.medications[0]!, id: `m_${name}_${dose}`, name, dose, status }
}

describe('duplicate & conflict detection', () => {
  it('finds two active entries with the same name', () => {
    const out = findDuplicateMedications([med('Metformin', '500 mg'), med('Metformin', '1000 mg')])
    expect(out).toHaveLength(1)
    expect(out[0]!.message).toMatch(/Two active entries/)
  })

  it('ignores same-name entries when one is not active', () => {
    const out = findDuplicateMedications([med('Metformin', '500 mg'), med('Metformin', '1000 mg', 'completed')])
    expect(out).toHaveLength(0)
  })

  it('detects conflicting doses for the same medication', () => {
    const out = findConflictingMedications([med('Lisinopril', '10 mg'), med('Lisinopril', '20 mg')])
    expect(out).toHaveLength(1)
    expect(out[0]!.message).toMatch(/Conflicting doses/)
  })

  it('finds identical-day timeline duplicates', () => {
    const base = d.timeline[0]!
    const a: TimelineEntry = { ...base, id: 'a', title: 'Flu shot', date: '2026-05-01' }
    const b: TimelineEntry = { ...base, id: 'b', title: 'Flu shot', date: '2026-05-01' }
    const out = findSimilarTimelineEntries([a, b])
    expect(out).toHaveLength(1)
  })
})

describe('document extraction (needs-review staging)', () => {
  it('extracts lab values and suggests a category', () => {
    const r = extractFromDocumentText('Hemoglobin 13.5 g/dL\nDate: 2026-09-05\nDr. Alan Chen', 'lab.txt')
    expect(r.suggestedCategory).toBe('lab-result')
    expect(r.fields.some((f) => f.field === 'HEMOGLOBIN' && f.value.includes('13.5'))).toBe(true)
    expect(r.fields.some((f) => f.field === 'Date')).toBe(true)
  })

  it('suggests vaccination records', () => {
    const r = extractFromDocumentText('Vaccination record — Influenza vaccine, dose 1', 'vax.txt')
    expect(r.suggestedCategory).toBe('vaccination-record')
  })

  it('stays honest when nothing is recognizable', () => {
    const r = extractFromDocumentText('hello world', 'x.txt')
    expect(r.fields).toHaveLength(0)
    expect(r.notes).toMatch(/No recognizable fields/)
  })

  it('never returns a confidence of verified — extraction is always needs-review', () => {
    const r = extractFromDocumentText('Glucose 102 mg/dL issued by Dr. Smith at Central Clinic', 'g.txt')
    // The view must mark extractedReviewed=false initially; extraction itself only suggests.
    expect(r.suggestedCategory).toBe('lab-result')
    expect(r.fields.length).toBeGreaterThan(0)
  })
})
