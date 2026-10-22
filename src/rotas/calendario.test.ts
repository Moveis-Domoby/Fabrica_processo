import { describe, expect, it } from 'vitest'
import {
  diaCurto,
  diaDaSemana,
  diaMes,
  diasDaSemana,
  gradeDoMes,
  inicioDaSemana,
  mesmoMes,
  periodoDoModo,
  somarDias,
  somarMeses,
  tituloDoPeriodo,
} from './calendario'

// SESSAO-39 (D-175): as contas do calendário — a semana do vídeo do dono
// (ClickUp) é "outubro 18 - outubro 24": de domingo a sábado.
describe('calendário da programação', () => {
  it('a semana começa no domingo, como no calendário do ClickUp do vídeo', () => {
    expect(diaDaSemana('2026-10-18')).toBe(0)
    expect(inicioDaSemana('2026-10-21')).toBe('2026-10-18')
    expect(inicioDaSemana('2026-10-18')).toBe('2026-10-18')
    expect(diasDaSemana('2026-10-24')).toEqual([
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
    ])
  })

  it('o título em português, na virada de mês e de ano', () => {
    expect(tituloDoPeriodo('semana', '2026-10-21')).toBe('18 a 24 de outubro de 2026')
    expect(tituloDoPeriodo('semana', '2026-10-01')).toBe('27 de setembro a 3 de outubro de 2026')
    expect(tituloDoPeriodo('semana', '2026-12-31')).toBe(
      '27 de dezembro de 2026 a 2 de janeiro de 2027',
    )
    expect(tituloDoPeriodo('mes', '2026-10-21')).toBe('outubro de 2026')
  })

  it('o mês é uma grade de 6 semanas a partir do domingo da semana do dia 1', () => {
    const grade = gradeDoMes('2026-10-21')
    expect(grade).toHaveLength(42)
    expect(grade[0]).toBe('2026-09-27')
    expect(grade[41]).toBe('2026-11-07')
    expect(mesmoMes('2026-09-30', '2026-10-21')).toBe(false)
    expect(mesmoMes('2026-10-01', '2026-10-21')).toBe(true)
  })

  it('o período pedido ao banco: 7 dias na semana, 42 no mês (cabe no teto de 6 semanas)', () => {
    expect(periodoDoModo('semana', '2026-10-21')).toEqual({ de: '2026-10-18', ate: '2026-10-24' })
    const mes = periodoDoModo('mes', '2026-10-21')
    expect(mes).toEqual({ de: '2026-09-27', ate: '2026-11-07' })
  })

  it('andar de semana em semana e de mês em mês sem pular dia', () => {
    expect(somarDias('2026-10-30', 3)).toBe('2026-11-02')
    expect(somarDias('2027-01-01', -7)).toBe('2026-12-25')
    expect(somarMeses('2026-10-31', 1)).toBe('2026-11-30')
    expect(somarMeses('2026-01-15', -1)).toBe('2025-12-15')
  })

  it('os rótulos curtos', () => {
    expect(diaCurto('2026-10-18')).toBe('18 out')
    expect(diaMes('2026-10-21')).toBe('21/10')
    expect(diaMes(null)).toBe('')
  })
})
