import { describe, expect, it } from 'vitest'
import { entregueHoje } from './api'

describe('entregueHoje (só a entrega do dia se desfaz — D-113)', () => {
  const agora = new Date('2026-10-08T14:00:00-03:00')

  it('a entrega de hoje, no fuso do galpão, conta', () => {
    expect(entregueHoje('2026-10-08T09:30:00-03:00', agora)).toBe(true)
  })

  it('a de ontem à noite não conta, mesmo que em UTC já seja hoje', () => {
    expect(entregueHoje('2026-10-07T22:30:00-03:00', agora)).toBe(false)
  })

  it('sem data não conta', () => {
    expect(entregueHoje(null, agora)).toBe(false)
  })
})
