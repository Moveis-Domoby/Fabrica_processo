import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import {
  corteMs,
  duracaoUtilDesde,
  formatarTempoUtil,
  intervalosUteis,
  noExpediente,
  periodosStandby,
  subtrair,
  tempoDoMovelMs,
  tempoPcpMs,
  tempoUtilMs,
  textoTempoDoMovel,
  unir,
} from './tempoUtil'
import type { ReguaTempo, TempoVivo } from './tempoUtil'

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

/**
 * SESSAO-42 — a régua do aparelho espelha fn_tempo_janelas / fn_tempo_corte:
 * o expediente em faixas (o almoço 12–13 não conta), o calendário (feriado,
 * dia trabalhado), a hora extra AUTORIZADA e o corte do fim do expediente.
 */
describe('a régua do calendário (SESSAO-42)', () => {
  // o relógio de Natal (UTC−3)
  const natal = (dia: string, hora: string) => Date.parse(`${dia}T${hora}:00-03:00`)
  const iso = (dia: string, hora: string) => new Date(natal(dia, hora)).toISOString()
  const MONTAGEM = 5
  const SEM_CORTE = 6
  const FRANKLIN = 'u-franklin'
  const faixas = (setor: number) =>
    [1, 2, 3, 4, 5].flatMap((d) => [
      [setor, d, '07:30:00', '12:00:00'] as [number, number, string, string],
      [setor, d, '13:00:00', '18:00:00'] as [number, number, string, string],
    ])
  const reguaNova: ReguaTempo = {
    fuso_min: -180,
    pcp_setor_id: null,
    papeis: { '5': 'producao', '6': 'producao' },
    janelas: [...faixas(MONTAGEM), ...faixas(SEM_CORTE)],
    pausas: [],
    excecoes: [
      [null, '2026-11-02', 'feriado', []],
      [MONTAGEM, '2026-10-31', 'trabalhado', [['08:00', '12:00']]],
      // a da fábrica perde para a do setor no mesmo dia
      [null, '2026-11-20', 'feriado', []],
      [MONTAGEM, '2026-11-20', 'trabalhado', [['07:30', '12:00']]],
    ],
    extras: [
      [MONTAGEM, null, iso('2026-10-28', '18:00'), iso('2026-10-28', '20:00')],
      [MONTAGEM, FRANKLIN, iso('2026-10-29', '18:00'), iso('2026-10-29', '19:00')],
    ],
    cortes: { '5': true, '6': false },
    lotes: { '5': true },
  }

  it('o almoço não conta: 11:10 → 13:57 num dia útil = 1h 47min', () => {
    const ms = tempoUtilMs(
      natal('2026-10-27', '11:10'),
      natal('2026-10-27', '13:57'),
      MONTAGEM,
      reguaNova,
    )
    expect(ms).toBe(107 * MIN)
    expect(formatarTempoUtil(ms)).toBe('1h 47min')
  })

  it('o feriado da fábrica não conta nada', () => {
    expect(
      tempoUtilMs(natal('2026-11-02', '07:00'), natal('2026-11-02', '19:00'), MONTAGEM, reguaNova),
    ).toBe(0)
  })

  it('o sábado trabalhado conta só as faixas dele', () => {
    const ini = natal('2026-10-31', '07:00')
    const fim = natal('2026-10-31', '13:00')
    expect(tempoUtilMs(ini, fim, MONTAGEM, reguaNova)).toBe(4 * H)
    // o outro setor não trabalhou no sábado
    expect(tempoUtilMs(ini, fim, SEM_CORTE, reguaNova)).toBe(0)
  })

  it('a exceção do setor vence a da fábrica no mesmo dia', () => {
    const ini = natal('2026-11-20', '07:00')
    const fim = natal('2026-11-20', '18:00')
    expect(tempoUtilMs(ini, fim, MONTAGEM, reguaNova)).toBe(4.5 * H)
    expect(tempoUtilMs(ini, fim, SEM_CORTE, reguaNova)).toBe(0)
  })

  it('a hora extra autorizada conta (a do setor para todos; a da pessoa só para ela)', () => {
    expect(
      tempoUtilMs(natal('2026-10-28', '17:00'), natal('2026-10-28', '21:00'), MONTAGEM, reguaNova),
    ).toBe(3 * H)
    const ini = natal('2026-10-29', '17:00')
    const fim = natal('2026-10-29', '21:00')
    expect(tempoUtilMs(ini, fim, MONTAGEM, reguaNova)).toBe(H)
    expect(tempoUtilMs(ini, fim, MONTAGEM, reguaNova, { usuarioId: FRANKLIN })).toBe(2 * H)
  })

  it('o corte é o fim da última janela do dia em que começou', () => {
    expect(corteMs(MONTAGEM, natal('2026-10-27', '15:00'), reguaNova)).toBe(
      natal('2026-10-27', '18:00'),
    )
    // começou no almoço: a tarde ainda é o mesmo dia
    expect(corteMs(MONTAGEM, natal('2026-10-27', '12:30'), reguaNova)).toBe(
      natal('2026-10-27', '18:00'),
    )
    // com a hora extra do setor, o corte vai para o fim dela
    expect(corteMs(MONTAGEM, natal('2026-10-28', '15:00'), reguaNova)).toBe(
      natal('2026-10-28', '20:00'),
    )
    // começou depois do expediente: corta já no começo da próxima janela
    expect(corteMs(MONTAGEM, natal('2026-10-27', '19:00'), reguaNova)).toBe(
      natal('2026-10-28', '07:30'),
    )
    // setor que não pausa sozinho, ou régua velha: sem corte
    expect(corteMs(SEM_CORTE, natal('2026-10-27', '15:00'), reguaNova)).toBeNull()
    expect(corteMs(MONTAGEM, natal('2026-10-27', '15:00'), regua)).toBeNull()
  })

  const vivo = (parcial: Partial<TempoVivo>): TempoVivo => ({
    setor_id: MONTAGEM,
    fechado_s: 0,
    fila_s: 0,
    desde: null,
    corte: null,
    dividir: 1,
    usuario_id: null,
    lote: null,
    ...parcial,
  })

  it('o tempo do móvel para no corte das 18:00 (não é mais relógio corrido)', () => {
    const v = vivo({ desde: iso('2026-10-27', '16:00') })
    expect(tempoDoMovelMs(v, reguaNova, natal('2026-10-27', '17:00'))).toBe(H)
    expect(tempoDoMovelMs(v, reguaNova, natal('2026-10-27', '22:00'))).toBe(2 * H)
    // na manhã seguinte o trecho velho não volta a contar
    expect(tempoDoMovelMs(v, reguaNova, natal('2026-10-28', '09:00'))).toBe(2 * H)
  })

  it('começou às 19:00 (fora do expediente, sem hora extra) = 0', () => {
    const v = vivo({ desde: iso('2026-10-27', '19:00') })
    expect(tempoDoMovelMs(v, reguaNova, natal('2026-10-27', '21:00'))).toBe(0)
    expect(tempoDoMovelMs(v, reguaNova, natal('2026-10-28', '09:00'))).toBe(0)
  })

  it('o fechado vem do banco; o vivo se divide no lote e respeita o corte que veio pronto', () => {
    const v = vivo({
      fechado_s: 1800,
      desde: iso('2026-10-27', '14:00'),
      corte: iso('2026-10-27', '16:00'),
      dividir: 2,
      lote: 'lote-1',
    })
    // 30 min fechados + (14:00 → 16:00 = 2 h) / 2
    expect(tempoDoMovelMs(v, reguaNova, natal('2026-10-27', '17:00'))).toBe(30 * MIN + H)
    expect(tempoDoMovelMs(vivo({ fechado_s: 600 }), reguaNova, natal('2026-10-27', '17:00'))).toBe(
      10 * MIN,
    )
  })

  it('o mostrador: "agora" no 1º minuto de um trecho novo', () => {
    const agora = natal('2026-10-27', '10:00')
    expect(
      textoTempoDoMovel(vivo({ desde: new Date(agora - 20_000).toISOString() }), reguaNova, agora),
    ).toBe('agora')
    expect(
      textoTempoDoMovel(
        vivo({ desde: iso('2026-10-27', '11:10') }),
        reguaNova,
        natal('2026-10-27', '13:57'),
      ),
    ).toBe('1h 47min')
  })
})
