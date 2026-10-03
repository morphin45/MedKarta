import { describe, expect, it } from 'vitest'
import { buildVisitPrepSummary } from './visits'
import { buildDemoData } from '@/data/seed'

const d = buildDemoData()
const appt = d.appointments[0]!

describe('visit goals', () => {
  it('includes the goals the user wrote', () => {
    const s = buildVisitPrepSummary({
      appointment: { ...appt, prepGoals: 'Understand my latest A1c\nAsk about the dizziness' },
      medications: [], allergies: [], conditions: [], timeline: [],
    })
    expect(s.text).toContain('Understand my latest A1c')
    expect(s.text).toContain('Ask about the dizziness')
    expect(s.text).not.toContain('No goals written yet')
  })

  it('tells the user goals are missing rather than pretending they exist', () => {
    const s = buildVisitPrepSummary({ appointment: { ...appt, prepGoals: undefined }, medications: [], allergies: [], conditions: [], timeline: [] })
    expect(s.text).toContain('No goals written yet')
  })

  it('ignores blank lines in the goals box', () => {
    const s = buildVisitPrepSummary({
      appointment: { ...appt, prepGoals: '\n\n   \n' },
      medications: [], allergies: [], conditions: [], timeline: [],
    })
    expect(s.text).toContain('No goals written yet')
  })
})
