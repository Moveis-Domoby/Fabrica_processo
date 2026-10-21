import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import {
  duracaoUtilDesde,
  formatarTempoUtil,
  intervalosUteis,
  noExpediente,
  periodosStandby,
  subtrair,
  tempoPcpMs,
  tempoUtilMs,
  unir,
} from './tempoUtil'
import type { ReguaTempo } from './tempoUtil'

/**
 * O motor do tempo útil (SESSAO-38 · F5) — os mesmos cenários da
 * fn_tempo_util das dashboards (D-29): janelas do setor no fuso da fábrica
 * (UTC−3), sem horário = tempo todo, pausa do setor desconta; e o que o card
 * acrescenta: hora extra conta (trabalho) e o stand-by não conta (excluir).
 */
const H = 3_600_000
const MIN = 60_000
// seg 20/10/2026 07:30 em Natal = 10:30 UTC
const seg0730 = Date.parse('2026-10-20T10:30:00Z')
const SECC = 2
const PCP = 1
const SEM_HORARIO = 99

const regua: ReguaTempo = {
  fuso_min: -180,
  pcp_setor_id: PCP,
  papeis: { '1': 'entrada', '2': 'producao', '8': 'terminal' },
  janelas: [1, 2, 3, 4, 5].flatMap((d) => [
    [SECC, d, '07:30:00', '18:00:00'] as [number, number, string, string],
    [PCP, d, '07:30:00', '18:00:00'] as [number, number, string, string],
  ]),
  pausas: [],
}

describe('a régua do tempo útil', () => {
  it('dentro do expediente conta igual ao relógio', () => {
    expect(tempoUtilMs(seg0730, seg0730 + 2 * H, SECC, regua)).toBe(2 * H)
  })

  it('a noite não conta — nem na fila', () => {
    // seg 17:00 → ter 08:00 (Natal): 1 h na segunda + 30 min na terça
    const ini = seg0730 + 9.5 * H
    const fim = seg0730 + 24.5 * H
    expect(tempoUtilMs(ini, fim, SECC, regua)).toBe(1.5 * H)
  })

  it('o fim de semana não conta', () => {
    // sex 23/10 17:00 → seg 26/10 08:30 (Natal)
    const ini = Date.parse('2026-10-23T20:00:00Z')
    const fim = Date.parse('2026-10-26T11:30:00Z')
    expect(tempoUtilMs(ini, fim, SECC, regua)).toBe(2 * H)
  })

  it('setor sem horário cadastrado funciona o tempo todo (D-29)', () => {
    expect(tempoUtilMs(seg0730, seg0730 + 30 * H, SEM_HORARIO, regua)).toBe(30 * H)
  })

  it('sem régua (banco antigo), o relógio corrido de sempre', () => {
    expect(tempoUtilMs(seg0730, seg0730 + 30 * H, SECC, null)).toBe(30 * H)
  })

  it('a pausa do setor desconta (aberta vai até agora)', () => {
    const comPausa: ReguaTempo = {
      ...regua,
      pausas: [[SECC, new Date(seg0730 + H).toISOString(), null]],
    }
    expect(tempoUtilMs(seg0730, seg0730 + 3 * H, SECC, comPausa)).toBe(H)
  })

  it('hora extra conta: quem trabalha fora do horário soma o tempo dele', () => {
    // seg 18:00 → 20:00 (Natal) fora do expediente, com execução das 18:30 às 19:30
    const ini = seg0730 + 10.5 * H
    const fim = ini + 2 * H
    const trabalho: [number, number][] = [[ini + 30 * MIN, ini + 90 * MIN]]
    expect(tempoUtilMs(ini, fim, SECC, regua)).toBe(0)
    expect(tempoUtilMs(ini, fim, SECC, regua, { trabalho })).toBe(H)
  })

  it('o stand-by não conta, nem como hora extra', () => {
    const excluir: [number, number][] = [[seg0730 + H, seg0730 + 3 * H]]
    expect(tempoUtilMs(seg0730, seg0730 + 4 * H, PCP, regua, { excluir })).toBe(2 * H)
  })

  it('agora é expediente? (segunda 08:00 sim; segunda 19:00 não; domingo não)', () => {
    expect(noExpediente(seg0730 + 30 * MIN, SECC, regua)).toBe(true)
    expect(noExpediente(seg0730 + 11.5 * H, SECC, regua)).toBe(false)
    expect(noExpediente(Date.parse('2026-10-25T13:00:00Z'), SECC, regua)).toBe(false)
    expect(noExpediente(Date.parse('2026-10-25T13:00:00Z'), SEM_HORARIO, regua)).toBe(true)
  })

  it('as contas de intervalo não mexem no que receberam', () => {
    const lista: [number, number][] = [
      [0, 10],
      [5, 20],
    ]
    expect(unir(lista)).toEqual([[0, 20]])
    expect(lista).toEqual([
      [0, 10],
      [5, 20],
    ])
    expect(
      subtrair(
        [[0, 100]],
        [
          [10, 20],
          [50, 200],
        ],
      ),
    ).toEqual([
      [0, 10],
      [20, 50],
    ])
    expect(intervalosUteis(10, 5, SECC, regua)).toEqual([])
  })
})

describe('o tempo do pedido no PCP', () => {
  it('da entrada até a liberação completa, só no expediente do PCP e sem o stand-by', () => {
    const pedido = {
      entrou_pcp_em: new Date(seg0730).toISOString(),
      liberado_completo_em: new Date(seg0730 + 24 * H).toISOString(), // ter 07:30
      standby_periodos: [
        { ini: new Date(seg0730 + H).toISOString(), fim: new Date(seg0730 + 2 * H).toISOString() },
      ],
    }
    // seg 07:30–18:00 = 10,5 h, menos 1 h de stand-by
    expect(tempoPcpMs(pedido, regua, seg0730 + 30 * H)).toBe(9.5 * H)
  })

  it('em stand-by agora: o relógio fica parado no começo do stand-by', () => {
    const pedido = {
      entrou_pcp_em: new Date(seg0730).toISOString(),
      standby_desde: new Date(seg0730 + 2 * H).toISOString(),
    }
    expect(tempoPcpMs(pedido, regua, seg0730 + 5 * H)).toBe(2 * H)
    expect(tempoPcpMs(pedido, regua, seg0730 + 9 * H)).toBe(2 * H)
    expect(periodosStandby(pedido)[0][1]).toBe(Infinity)
  })

  it('sem a entrada no PCP não há relógio', () => {
    expect(tempoPcpMs({ entrou_pcp_em: null }, regua, seg0730)).toBeNull()
  })
})

describe('o mostrador', () => {
  it('em horas, sem "dias"', () => {
    expect(formatarTempoUtil(45_000)).toBe('45s')
    expect(formatarTempoUtil(12 * MIN)).toBe('12min')
    expect(formatarTempoUtil(3 * H + 5 * MIN)).toBe('3h 05min')
    expect(formatarTempoUtil(29 * H + 10 * MIN)).toBe('29h 10min')
    expect(formatarTempoUtil(48 * H)).toBe('48h')
  })

  it('o contador do card: "agora" no 1º minuto; fora do expediente o relógio não anda', () => {
    const desde = new Date(seg0730 + 10 * H).toISOString() // seg 17:30
    expect(duracaoUtilDesde(desde, seg0730 + 10 * H + 30_000, SECC, regua)).toBe('agora')
    expect(duracaoUtilDesde(desde, seg0730 + 14 * H, SECC, regua)).toBe('30min')
    expect(duracaoUtilDesde(desde, seg0730 + 24.5 * H, SECC, regua)).toBe('1h')
    expect(duracaoUtilDesde(null, seg0730, SECC, regua)).toBe('—')
  })
})
