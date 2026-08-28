import { describe, expect, it } from 'vitest'
import { duracaoLegivel, msDeIntervalo } from './intervalo'

describe('msDeIntervalo — o parser do interval do Postgres', () => {
  it('hh:mm:ss simples', () => {
    expect(msDeIntervalo('02:03:04')).toBe(2 * 3_600_000 + 3 * 60_000 + 4_000)
  })
  it('com dias e fração de segundo', () => {
    expect(msDeIntervalo('1 day 02:00:00.5')).toBe(86_400_000 + 2 * 3_600_000 + 500)
  })
  it('só dias, plural', () => {
    expect(msDeIntervalo('2 days')).toBe(2 * 86_400_000)
  })
  it('negativo', () => {
    expect(msDeIntervalo('-01:30:00')).toBe(-(90 * 60_000))
  })
  it('nulo/vazio viram zero', () => {
    expect(msDeIntervalo(null)).toBe(0)
    expect(msDeIntervalo('')).toBe(0)
  })
  it('mostrador humano', () => {
    expect(duracaoLegivel('03:05:00')).toBe('3h 05min')
    expect(duracaoLegivel('00:00:45')).toBe('45s')
  })
})
