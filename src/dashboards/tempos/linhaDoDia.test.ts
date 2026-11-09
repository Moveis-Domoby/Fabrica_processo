import { describe, expect, it } from 'vitest'
import type { TrechoDia } from './api'
import { marcasDoPadrao } from './linhaDoDia'

/**
 * SESSAO-47 (Bloco C) — a marca do tempo padrão na linha do dia: onde o móvel
 * terminaria se levasse o tempo padrão do modelo. Horas em UTC (a fábrica é UTC−3).
 */
const trecho = (parcial: Partial<TrechoDia> & { inicio: string; fim: string }): TrechoDia => ({
  pessoa: 'p1',
  card_id: 1,
  movel: 'Mesa Lille',
  papel: 'execucao',
  descartado: false,
  cortado: false,
  origem: 'plataforma',
  ref: 10,
  padrao_s: 2400,
  movel_s: 1800,
  ...parcial,
})
const hora = (quando: number) => new Date(quando).toISOString().slice(11, 16)

describe('a marca do tempo padrão na linha do dia', () => {
  it('móvel mais rápido que o padrão: a marca fica depois do fim, na diferença', () => {
    // montou das 08:00 às 08:30 (30 min); o padrão é 40 min → terminaria às 08:40
    const marcas = marcasDoPadrao([
      trecho({ inicio: '2026-11-09T11:00:00Z', fim: '2026-11-09T11:30:00Z' }),
    ])
    expect(marcas).toHaveLength(1)
    expect(hora(marcas[0].quando)).toBe('11:40')
    expect(marcas[0].titulo).toBe('Mesa Lille · no tempo padrão (40 min) terminaria às 08:40')
  })

  it('móvel mais lento: a marca cai dentro do trabalho, pulando a pausa', () => {
    // 11:30–12:00 e 13:00–13:30 (60 min de trabalho, almoço no meio); o padrão é 45 min →
    // os 45 min se completam aos 15 min do 2º trecho: 13:15
    const marcas = marcasDoPadrao([
      trecho({
        inicio: '2026-11-09T14:30:00Z',
        fim: '2026-11-09T15:00:00Z',
        padrao_s: 2700,
        movel_s: 3600,
      }),
      trecho({
        inicio: '2026-11-09T16:00:00Z',
        fim: '2026-11-09T16:30:00Z',
        padrao_s: 2700,
        movel_s: 3600,
      }),
    ])
    expect(marcas).toHaveLength(1)
    expect(hora(marcas[0].quando)).toBe('16:15')
  })

  it('móvel em lote: o tempo do móvel é a metade do relógio — a marca respeita isso', () => {
    // dois móveis juntos das 09:00 às 10:00: cada um vale 30 min; o padrão é 40 min →
    // cada um terminaria 10 min depois do fim
    const marcas = marcasDoPadrao([
      trecho({ ref: 1, inicio: '2026-11-09T12:00:00Z', fim: '2026-11-09T13:00:00Z' }),
      trecho({ ref: 2, inicio: '2026-11-09T12:00:00Z', fim: '2026-11-09T13:00:00Z' }),
    ])
    expect(marcas.map((m) => hora(m.quando))).toEqual(['13:10', '13:10'])
  })

  it('sem padrão do modelo, ajudando ou clique errado: nenhuma marca', () => {
    const base = { inicio: '2026-11-09T11:00:00Z', fim: '2026-11-09T11:30:00Z' }
    expect(marcasDoPadrao([trecho({ ...base, padrao_s: null })])).toEqual([])
    expect(marcasDoPadrao([trecho({ ...base, movel_s: null })])).toEqual([])
    expect(marcasDoPadrao([trecho({ ...base, papel: 'auxilio' })])).toEqual([])
    expect(marcasDoPadrao([trecho({ ...base, descartado: true })])).toEqual([])
    // a resposta do banco de antes não traz o móvel do trecho
    expect(marcasDoPadrao([trecho({ ...base, ref: undefined })])).toEqual([])
  })

  it('dois móveis da mesma pessoa: uma marca para cada um', () => {
    const marcas = marcasDoPadrao([
      trecho({ ref: 1, inicio: '2026-11-09T11:00:00Z', fim: '2026-11-09T11:30:00Z' }),
      trecho({
        ref: 2,
        origem: 'trello',
        movel: 'Rack',
        inicio: '2026-11-09T12:00:00Z',
        fim: '2026-11-09T13:00:00Z',
        padrao_s: 1800,
        movel_s: 3600,
      }),
    ])
    expect(marcas.map((m) => hora(m.quando)).sort()).toEqual(['11:40', '12:30'])
  })
})
