import { describe, expect, it } from 'vitest'
import { diaEHora, diaHoraCurto } from './formato'
import {
  horaDaEntregaVale,
  quandoCurtoDaEntrega,
  quandoFoiEntregueNaLista,
  registroDaEntregaNaLista,
} from './horaDaEntrega'

/**
 * SESSAO-52 — a regra da data única nas listas: o dia mostrado é sempre o dia
 * real da entrega; a hora só aparece quando é a hora de verdade (a entrega
 * registrada na hora em que aconteceu). Dia escolhido ou corrigido = só o dia.
 */
// registrada em 09/11 às 10:32 de Natal (13:32 UTC)
const REGISTRO = '2026-11-09T13:32:10.123Z'
// "entregue no dia 06/11": o banco guarda o fim do expediente daquele dia (17:15 de Natal)
const DIA_ESCOLHIDO = '2026-11-06T20:15:00Z'
// corrigida para o PRÓPRIO dia do registro: o fim do expediente de 09/11
const CORRIGIDA_PARA_O_MESMO_DIA = '2026-11-09T20:15:00Z'

describe('a hora da entrega vale? (SESSAO-52)', () => {
  it('registrada na hora em que aconteceu: vale (os dois instantes são o mesmo)', () => {
    expect(horaDaEntregaVale(REGISTRO, REGISTRO)).toBe(true)
    expect(horaDaEntregaVale('2026-11-09T13:32:10.100Z', REGISTRO)).toBe(true)
  })

  it('dia escolhido ou corrigido: não vale — a hora guardada é a do fim do expediente', () => {
    expect(horaDaEntregaVale(DIA_ESCOLHIDO, REGISTRO)).toBe(false)
    expect(horaDaEntregaVale(CORRIGIDA_PARA_O_MESMO_DIA, REGISTRO)).toBe(false)
  })

  it('sem a hora do registro (o banco de antes): vale a da entrega, como sempre foi', () => {
    expect(horaDaEntregaVale(REGISTRO, null)).toBe(true)
    expect(horaDaEntregaVale(REGISTRO, undefined)).toBe(true)
    expect(horaDaEntregaVale(null, REGISTRO)).toBe(false)
  })
})

describe('a lista de pedidos: só o dia quando ele foi escolhido (SESSAO-52)', () => {
  it('entrega do próprio registro: o dia e a hora, e nada de "registrado em"', () => {
    expect(quandoFoiEntregueNaLista(REGISTRO, REGISTRO)).toBe(diaEHora(REGISTRO))
    expect(registroDaEntregaNaLista(REGISTRO, REGISTRO)).toBeNull()
  })

  it('dia escolhido: "no dia 06/11/2026" (o dia real, no fuso da fábrica), sem a hora do fim do expediente', () => {
    const texto = quandoFoiEntregueNaLista(DIA_ESCOLHIDO, REGISTRO)
    expect(texto).toBe('no dia 06/11/2026')
    expect(texto).not.toMatch(/\d{2}:\d{2}/)
    expect(registroDaEntregaNaLista(DIA_ESCOLHIDO, REGISTRO)).toMatch(
      /^registrado em \d{2}\/\d{2} às \d{2}:\d{2}$/,
    )
  })

  it('o dia é o da fábrica: 02:30 UTC ainda é o dia anterior em Natal', () => {
    expect(quandoFoiEntregueNaLista('2026-11-07T02:30:00Z', REGISTRO)).toBe('no dia 06/11/2026')
  })

  it('corrigida para o mesmo dia do registro: também só o dia', () => {
    expect(quandoFoiEntregueNaLista(CORRIGIDA_PARA_O_MESMO_DIA, REGISTRO)).toBe(
      'no dia 09/11/2026',
    )
  })

  it('sem a hora do registro: a linha de sempre', () => {
    expect(quandoFoiEntregueNaLista(REGISTRO, undefined)).toBe(diaEHora(REGISTRO))
    expect(registroDaEntregaNaLista(REGISTRO, undefined)).toBeNull()
  })
})

describe('o histórico da devolução: a entrega no dia vigente (SESSAO-52)', () => {
  it('entrega do próprio registro: dia e hora', () => {
    expect(quandoCurtoDaEntrega(REGISTRO, REGISTRO)).toBe(diaHoraCurto(REGISTRO))
  })

  it('dia escolhido ou corrigido: só o dia vigente', () => {
    expect(quandoCurtoDaEntrega(DIA_ESCOLHIDO, REGISTRO)).toBe('06/11')
    expect(quandoCurtoDaEntrega(CORRIGIDA_PARA_O_MESMO_DIA, REGISTRO)).toBe('09/11')
  })
})
