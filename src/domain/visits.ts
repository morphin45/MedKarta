// ─── Doctor-visit preparation summary ────────────────────────────────────────
// Deterministic, template-based summarization of ONLY the user's own records.
// No LLM in the loop for MVP: output is auditable, reproducible, and cannot
// invent facts. Every summary carries provenance metadata.

import type { Allergy, Appointment, MedicalCondition, Medication, TimelineEntry } from '@/types'

export interface VisitPrepSummaryInput {
  appointment: Appointment
  medications: Medication[]
  allergies: Allergy[]
  conditions: MedicalCondition[]
  timeline: TimelineEntry[]
}

export interface VisitPrepSummary {
  text: string
  generatedAt: string
  sourceIds: string[]
  disclaimer: string
}

export const SUMMARY_DISCLAIMER =
  'Generated from your information — not medical advice. Review for accuracy before your visit.'

export function buildVisitPrepSummary(input: VisitPrepSummaryInput): VisitPrepSummary {
  const { appointment, medications, allergies, conditions, timeline } = input
  const sourceIds: string[] = [appointment.id]
  const L: string[] = []
  const add = (s: string) => L.push(s)

  add('BEFORE-VISIT SUMMARY — prepared for your appointment')
  add(`Appointment: ${appointment.reason || 'General check-in'}`)
  add(`When: ${new Date(appointment.datetime).toLocaleString()}`)
  add('')

  const symptomEntries = timeline
    .filter((t) => !t.deletedAt && t.category === 'symptom')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6)
  add('SYMPTOMS & RECENT CHANGES (last 6 logged, newest first)')
  if (symptomEntries.length === 0) add('• None logged.')
  for (const s of symptomEntries) {
    sourceIds.push(s.id)
    add(`• ${s.title} — since ${s.date}${s.notes ? `; ${s.notes}` : ''} [${s.verificationStatus}]`)
  }

  add('')
  add('CURRENT MEDICATIONS')
  const meds = medications.filter((m) => m.status === 'active' && !m.deletedAt)
  if (meds.length === 0) add('• None recorded.')
  for (const m of meds) {
    sourceIds.push(m.id)
    add(`• ${m.name} ${m.dose} — ${m.frequency}${m.confirmedByClinician ? ' [confirmed by clinician]' : ' [user-entered]'}`)
  }

  add('')
  add('ALLERGIES')
  const alg = allergies.filter((a) => !a.deletedAt)
  if (alg.length === 0) add('• None recorded.')
  for (const a of alg) {
    sourceIds.push(a.id)
    add(`• ${a.substance}${a.reaction ? ` — ${a.reaction}` : ''} [${a.severity}${a.verified ? ', verified' : ', unverified'}]`)
  }

  add('')
  add('RELEVANT HISTORY')
  const hist = conditions.filter((c) => !c.deletedAt)
  if (hist.length === 0) add('• No conditions recorded.')
  for (const c of hist) {
    sourceIds.push(c.id)
    add(`• ${c.name} (${c.status})`)
  }

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const recent = timeline
    .filter((t) => !t.deletedAt && new Date(t.date) >= sixMonthsAgo && t.category !== 'symptom')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
  add('')
  add('RECENT HEALTH EVENTS (last 6 months)')
  if (recent.length === 0) add('• None in the last 6 months.')
  for (const t of recent) {
    sourceIds.push(t.id)
    add(`• ${t.title} — ${t.date} [${t.category}]`)
  }

  add('')
  add('QUESTIONS TO ASK — collected from your notes')
  const questions = timeline.filter((t) => !t.deletedAt && t.tags.includes('question'))
  if (questions.length === 0) add('• (Add question tags to timeline notes to include them here.)')
  for (const q of questions) {
    sourceIds.push(q.id)
    add(`• ${q.title}${q.notes ? ` — ${q.notes}` : ''}`)
  }

  add('')
  add('GOALS FOR THIS APPOINTMENT')
  const goals = appointment.prepGoals?.split('\n').map((g) => g.trim()).filter(Boolean) ?? []
  if (goals.length === 0) {
    add('• (No goals written yet — add them before the visit, e.g. "understand my latest lab results".)')
  } else {
    for (const g of goals) add(`• ${g}`)
  }

  add('')
  add(SUMMARY_DISCLAIMER)

  return {
    text: L.join('\n'),
    generatedAt: new Date().toISOString(),
    sourceIds,
    disclaimer: SUMMARY_DISCLAIMER,
  }
}
