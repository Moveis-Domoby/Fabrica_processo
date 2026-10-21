import { describe, expect, it } from 'vitest'
import { corDoPrazo, diaDoPrazo, diasAte, textoDoPrazo } from './prazo'

// 21/10/2026, meio da tarde (hora local) — o "hoje" dos testes
const AGORA = new Date(2026, 9, 21, 15, 30).getTime()

describe('prazo do card (SESSAO-38 — a cor da data de entrega)', () => {
  it('conta os dias de calendário até a entrega', () => {
    expect(diasAte('2026-10-21', AGORA)).toBe(0)
    expect(diasAte('2026-10-22', AGORA)).toBe(1)
    expect(diasAte('2026-10-25', AGORA)).toBe(4)
    expect(diasAte('2026-10-19', AGORA)).toBe(-2)
    expect(diasAte('2026-11-02', AGORA)).toBe(12)
  })

  it('verde com mais de 3 dias; amarelo com 2 ou 3; vermelho com 1, no dia ou atrasado', () => {
    expect(corDoPrazo(4)).toBe('verde')
    expect(corDoPrazo(30)).toBe('verde')
    expect(corDoPrazo(3)).toBe('amarelo')
    expect(corDoPrazo(2)).toBe('amarelo')
    expect(corDoPrazo(1)).toBe('vermelho')
    expect(corDoPrazo(0)).toBe('vermelho')
    expect(corDoPrazo(-5)).toBe('vermelho')
  })

  it('mostra só o dia e o mês (o ano só quando não é o deste ano)', () => {
    expect(diaDoPrazo('2026-10-25', AGORA)).toBe('25/10')
    expect(diaDoPrazo('2027-01-05', AGORA)).toBe('05/01/2027')
  })

  it('diz em palavras quanto falta (o nome para quem não vê a cor)', () => {
    expect(textoDoPrazo('2026-10-21', AGORA)).toBe('Entrega hoje (21/10)')
    expect(textoDoPrazo('2026-10-22', AGORA)).toBe('Entrega amanhã (22/10)')
    expect(textoDoPrazo('2026-10-24', AGORA)).toBe('Entrega em 24/10 — faltam 3 dias')
    expect(textoDoPrazo('2026-10-20', AGORA)).toBe('Entrega era em 20/10 — atrasada há 1 dia')
    expect(textoDoPrazo('2026-10-18', AGORA)).toBe('Entrega era em 18/10 — atrasada há 3 dias')
  })
})
