import { describe, expect, it } from 'vitest'
import {
  diaCurto,
  diaNaFabrica,
  diaPorExtenso,
  entregueEmOutroDia,
  hojeNaFabrica,
  problemaDoDia,
  registradaHoje,
} from './diaDaEntrega'
import { hojeNaFabrica as hojeDoPainelDeTempos } from '@/dashboards/tempos/formato'

describe('o dia da entrega (SESSAO-47) — as contas da tela, na régua do banco', () => {
  it('o dia é sempre o do fuso da fábrica', () => {
    // 23:30 de 08/11 em Natal já é 09/11 em UTC
    expect(diaNaFabrica('2026-11-09T02:30:00Z')).toBe('2026-11-08')
    expect(diaNaFabrica('2026-11-09T03:00:00Z')).toBe('2026-11-09')
    expect(diaNaFabrica('2026-11-08T18:00:00-03:00')).toBe('2026-11-08')
    expect(diaNaFabrica(null)).toBeNull()
    expect(diaNaFabrica('isto não é uma data')).toBeNull()
  })

  it('"hoje" é o dia da fábrica — a mesma conta do painel de tempos, sem carregar o painel', () => {
    // 23:30 de 05/11 em Natal: em UTC já virou o dia
    const quaseMeiaNoite = Date.parse('2026-11-06T02:30:00Z')
    expect(hojeNaFabrica(quaseMeiaNoite)).toBe('2026-11-05')
    expect(hojeNaFabrica(Date.parse('2026-11-06T03:00:00Z'))).toBe('2026-11-06')
    for (const agora of [quaseMeiaNoite, Date.parse('2026-12-31T23:59:59-03:00'), Date.now()])
      expect(hojeNaFabrica(agora)).toBe(hojeDoPainelDeTempos(agora))
  })

  it('amanhã não vale; antes de o pedido chegar também não; hoje e os dias desde a chegada valem', () => {
    const hoje = '2026-11-09'
    expect(problemaDoDia('2026-11-10', null, hoje)).toMatch(/ainda não chegou/)
    expect(problemaDoDia('2026-11-09', null, hoje)).toBeNull()
    expect(problemaDoDia('2026-11-01', null, hoje)).toBeNull()
    // o pedido chegou em 04/11 às 17:04 de Natal
    expect(problemaDoDia('2026-11-03', '2026-11-04T20:04:00Z', hoje)).toMatch(
      /chegou à plataforma em 04\/11\/2026/,
    )
    expect(problemaDoDia('2026-11-04', '2026-11-04T20:04:00Z', hoje)).toBeNull()
    expect(problemaDoDia('', null, hoje)).toMatch(/Escolha o dia/)
  })

  it('"do dia" é o dia em que a entrega foi REGISTRADA, não o dia escolhido', () => {
    const agora = new Date('2026-11-09T15:00:00-03:00').getTime()
    // marcada hoje como "entregue ontem": ainda se desfaz hoje
    expect(registradaHoje('2026-11-09T10:32:00-03:00', '2026-11-08T18:00:00-03:00', agora)).toBe(
      true,
    )
    // registrada ontem: hoje, só o administrador
    expect(registradaHoje('2026-11-08T10:00:00-03:00', '2026-11-08T10:00:00-03:00', agora)).toBe(
      false,
    )
    // o banco de antes não manda a hora do registro: vale a da entrega
    expect(registradaHoje(undefined, '2026-11-09T09:00:00-03:00', agora)).toBe(true)
    expect(registradaHoje(null, null, agora)).toBe(false)
  })

  it('sabe quando a entrega aconteceu num dia e foi registrada em outro', () => {
    expect(entregueEmOutroDia('2026-11-08T18:00:00-03:00', '2026-11-09T10:32:00-03:00')).toBe(true)
    expect(entregueEmOutroDia('2026-11-09T09:00:00-03:00', '2026-11-09T09:00:00-03:00')).toBe(false)
    // sem a hora do registro (o banco de antes), nada a dizer
    expect(entregueEmOutroDia('2026-11-08T18:00:00-03:00', undefined)).toBe(false)
  })

  it('escreve o dia como a gente fala', () => {
    expect(diaPorExtenso('2026-11-08')).toBe('08/11/2026')
    expect(diaCurto('2026-11-08')).toBe('08/11')
  })
})
