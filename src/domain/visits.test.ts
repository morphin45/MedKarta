import { describe, expect, it } from 'vitest'
import { buildVisitPrepSummary, SUMMARY_DISCLAIMER } from './visits'
import { buildDemoData } from '@/data/seed'

const d = buildDemoData()

describe('visit preparation summary', () => {
  it('includes medication, allergy and history sections from user data only', () => {
    const appt = d.appointments[0]!
    const s = buildVisitPrepSummary({
      appointment: appt,
      medications: d.medications,
      allergies: d.allergies,
      conditions: d.conditions,
      timeline: d.timeline,
    })
    expect(s.text).toContain('Metformin')
    expect(s.text).toContain('Penicillin')
    expect(s.text).toContain('Type 2 diabetes')
    expect(s.text).toContain('dizzy spells')
    expect(s.text).toContain(SUMMARY_DISCLAIMER)
    expect(s.sourceIds).toContain(appt.id)
    expect(s.generatedAt).toBeTruthy()
  })

  it('does not invent facts when records are empty', () => {
    const appt = d.appointments[0]!
    const s = buildVisitPrepSummary({ appointment: appt, medications: [], allergies: [], conditions: [], timeline: [] })
    expect(s.text).toContain('None recorded')
    expect(s.text).toContain('None logged')
  })

  it('lists question-tagged notes as questions for the clinician', () => {
    const appt = d.appointments[0]!
    const s = buildVisitPrepSummary({
      appointment: appt, medications: [], allergies: [], conditions: [],
      timeline: d.timeline.filter((t) => t.tags.includes('question')),
    })
    expect(s.text).toContain('is dizziness a side effect')
  })
})
