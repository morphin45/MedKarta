// ─── Document extraction ("OCR" in spirit) ───────────────────────────────────
// MVP: deterministic heuristics over the pasted/derived text of a document.
// Everything lands in a needs-review staging area; nothing enters the
// timeline until the user confirms it. If text looks empty (e.g. scanned
// image), the UI tells the user to paste the text from the document.

import type { DocumentCategory, ExtractedField, TimelineCategory } from '@/types'

export interface ExtractionResult {
  fields: ExtractedField[]
  suggestedCategory: DocumentCategory
  suggestedTitle: string
  suggestedTimelineCategory?: TimelineCategory
  notes: string
}

const LAB_KEYS = ['hemoglobin', 'glucose', 'a1c', 'hba1c', 'cholesterol', 'ldl', 'hdl', 'triglycerides', 'creatinine', 'tsh', 'potassium', 'sodium', 'iron', 'ferritin']
const RX_HINTS = ['rx', 'prescription', 'sig:', 'dispense', 'refills', 'take one', 'twice daily', 'once daily']
const VACCINE_HINTS = ['vaccine', 'vaccination', 'immunization', 'booster', 'dose 1', 'dose 2']

export function extractFromDocumentText(text: string, filename: string): ExtractionResult {
  const lower = text.toLowerCase()
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  let suggestedCategory: DocumentCategory = 'other'
  if (VACCINE_HINTS.some((h) => lower.includes(h))) suggestedCategory = 'vaccination-record'
  else if (LAB_KEYS.some((k) => lower.includes(k))) suggestedCategory = 'lab-result'
  else if (RX_HINTS.some((h) => lower.includes(h))) suggestedCategory = 'prescription'
  else if (/discharge|admitted|released/.test(lower)) suggestedCategory = 'hospital-discharge'
  else if (/report|scan|mri|ct|x-ray|radiology/.test(lower)) suggestedCategory = 'imaging-report'

  const fields: ExtractedField[] = []

  const dateMatch = text.match(/(date|collected|performed|issued)[:\s]+([A-Za-z0-9,\s/.\-]{6,24})/i)
  if (dateMatch?.[2]) fields.push({ field: 'Date', value: dateMatch[2].trim(), confidence: 'medium' })

  const doctorMatch = text.match(/(dr\.?|doctor)\s+([A-Z][a-zA-Z.\-']+(?:\s+[A-Z][a-zA-Z.\-']{2,})?)/)
  if (doctorMatch?.[2]) fields.push({ field: 'Provider mentioned', value: doctorMatch[2].trim(), confidence: 'medium' })

  const facilityMatch = text.match(/(?:facility|hospital|clinic|laboratories?)[:\s]+([A-Z][^;\n]{2,48})/)
  if (facilityMatch?.[1]) fields.push({ field: 'Facility', value: facilityMatch[1].trim(), confidence: 'low' })

  for (const key of LAB_KEYS) {
    const re = new RegExp(`${key}\\s*[:=]?\\s*([0-9]+(?:\\.[0-9]+)?)\\s*([a-zA-Z/%]{0,12})`, 'i')
    const m = text.match(re)
    if (m) fields.push({ field: key.toUpperCase(), value: `${m[1]}${m[2] ? ` ${m[2]}` : ''}`, confidence: 'medium' })
  }

  const vaccineMatch = text.match(/(influenza|covid-19|hepatitis b|hpv|tdap|mmr|shingles|pneumococcal)[^\n]{0,60}/i)
  if (vaccineMatch?.[1]) fields.push({ field: 'Vaccine mentioned', value: vaccineMatch[1], confidence: 'low' })

  const medMatch = text.match(/(metformin|lisinopril|atorvastatin|levothyroxine|amlodipine|metoprolol|insulin [a-z ]{0,12})/i)
  if (medMatch?.[1]) fields.push({ field: 'Medication mentioned', value: medMatch[1], confidence: 'low' })

  const titleGuess =
    suggestedCategory === 'lab-result' ? 'Lab result'
    : suggestedCategory === 'prescription' ? 'Prescription'
    : suggestedCategory === 'vaccination-record' ? 'Vaccination record'
    : suggestedCategory === 'imaging-report' ? 'Imaging report'
    : suggestedCategory === 'hospital-discharge' ? 'Hospital document'
    : (lines[0] ?? filename).slice(0, 60)

  return {
    fields,
    suggestedCategory,
    suggestedTitle: titleGuess,
    suggestedTimelineCategory:
      suggestedCategory === 'lab-result' ? 'lab'
      : suggestedCategory === 'vaccination-record' ? 'vaccination'
      : suggestedCategory === 'imaging-report' ? 'imaging'
      : suggestedCategory === 'prescription' ? 'medication'
      : undefined,
    notes:
      fields.length === 0
        ? 'No recognizable fields found. Check the extracted text, or enter details manually — nothing was added to your timeline.'
        : 'Extraction is imperfect. Verify every field against the original document before confirming; the original stays unchanged.',
  }
}
