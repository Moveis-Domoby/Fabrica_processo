import { describe, expect, it } from 'vitest'
import {
  contraPadrao,
  diaPorExtenso,
  duracao,
  hojeNaFabrica,
  horaNaFabrica,
  intervaloDoPeriodo,
  msAteMeiaNoite,
  nomeDaChave,
} from './formato'

describe('formato dos tempos de produção', () => {
  it('duração em língua de gente', () => {
    expect(duracao(30)).toBe('30 s')
    expect(duracao(45 * 60)).toBe('45 min')
    expect(duracao(65 * 60)).toBe('1h 05min')
    expect(duracao(null)).toBe('—')
  })

  it('contra o padrão: ±10% é "na média"; fora disso, mais rápido ou mais lento', () => {
    expect(contraPadrao(42 * 60, 42 * 60, 10)).toEqual({ texto: 'na média', tipo: 'media' })
    expect(contraPadrao(46 * 60, 42 * 60, 10)).toEqual({ texto: 'na média', tipo: 'media' })
    expect(contraPadrao(30 * 60, 40 * 60, 10)).toEqual({ texto: '25% mais rápido', tipo: 'rapido' })
    expect(contraPadrao(50 * 60, 40 * 60, 10)).toEqual({ texto: '25% mais lento', tipo: 'lento' })
    expect(contraPadrao(50 * 60, null, 10)).toBeNull()
  })

  it('o nome de uma chave de montadores: dupla, sem montador e os outros', () => {
    const pessoas = {
      a: { nome: 'Franklin da Silva', foto: null },
      b: { nome: 'Franklinildo Souza', foto: null },
    }
    expect(nomeDaChave('a', pessoas)).toBe('Franklin')
    expect(nomeDaChave('a,b', pessoas)).toBe('Franklin + Franklinildo')
    expect(nomeDaChave('', pessoas)).toBe('Sem montador')
    expect(nomeDaChave('+', pessoas)).toBe('Outros')
  })

  it('os períodos contam de hoje, nas duas pontas; mês passado inteiro; personalizado até 12 meses', () => {
    expect(intervaloDoPeriodo('7', '2026-11-05')).toEqual({ de: '2026-10-30', ate: '2026-11-05' })
    expect(intervaloDoPeriodo('mes', '2026-11-05')).toEqual({ de: '2026-11-01', ate: '2026-11-05' })
    expect(intervaloDoPeriodo('mes-passado', '2026-11-05')).toEqual({
      de: '2026-10-01',
      ate: '2026-10-31',
    })
    expect(intervaloDoPeriodo('mes-passado', '2026-03-10')).toEqual({
      de: '2026-02-01',
      ate: '2026-02-28',
    })
    expect(
      intervaloDoPeriodo('pers', '2026-11-05', { de: '2026-10-10', ate: '2026-10-01' }),
    ).toEqual({
      de: '2026-10-01',
      ate: '2026-10-10',
    })
    expect(
      intervaloDoPeriodo('pers', '2026-11-05', { de: '2024-01-01', ate: '2026-11-05' }).de,
    ).toBe('2025-11-04')
  })

  it('o dia e a hora são os da fábrica (UTC−3), não os do aparelho', () => {
    // 02:30 UTC de 06/11 ainda é 05/11 23:30 na fábrica
    expect(hojeNaFabrica(Date.parse('2026-11-06T02:30:00Z'))).toBe('2026-11-05')
    expect(horaNaFabrica('2026-11-05T10:30:00Z')).toBe('07:30')
    expect(diaPorExtenso('2026-11-05')).toBe('Quinta-feira, 5 de novembro')
    expect(msAteMeiaNoite(Date.parse('2026-11-06T02:30:00Z'))).toBe(30 * 60_000)
  })
})
