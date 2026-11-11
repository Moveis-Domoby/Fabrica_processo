import { describe, expect, it } from 'vitest'
import { diasParaSumir, pecaCancelada, textoCancelada, textoSome } from './cancelada'

// 11/11/2026 15:00 no horário local do aparelho
const CANCELADA = new Date(2026, 10, 11, 15, 0).toISOString()
const dia = (d: number, h = 10) => new Date(2026, 10, d, h, 0).getTime()

describe('a peça com a fabricação cancelada (SESSAO-48)', () => {
  it('só a peça (unidade) com a data de cancelamento conta como cancelada', () => {
    expect(pecaCancelada({ tipo: 'unidade', cancelada_em: CANCELADA })).toBe(true)
    expect(pecaCancelada({ tipo: 'unidade', cancelada_em: null })).toBe(false)
    expect(pecaCancelada({ tipo: 'unidade' })).toBe(false)
    expect(pecaCancelada({ tipo: 'avulso', cancelada_em: CANCELADA })).toBe(false)
  })

  it('diz quando saiu, pelo motivo da coluna', () => {
    expect(textoCancelada('cancelada', CANCELADA)).toBe('Cancelada em 11/11')
    expect(textoCancelada('nao_encontrada', CANCELADA)).toBe('Não encontrada em 11/11')
    expect(textoCancelada(null, CANCELADA)).toBe('Cancelada em 11/11')
  })

  it('conta os dias de calendário até sumir da coluna (7 por padrão)', () => {
    expect(diasParaSumir(CANCELADA, 7, dia(11, 16))).toBe(7)
    expect(textoSome(CANCELADA, 7, dia(11, 16))).toBe('some em 7 dias')
    expect(textoSome(CANCELADA, 7, dia(16))).toBe('some em 2 dias')
    expect(textoSome(CANCELADA, 7, dia(17))).toBe('some amanhã')
    expect(textoSome(CANCELADA, 7, dia(18, 9))).toBe('some hoje')
    // depois do prazo (a limpeza da madrugada ainda não rodou): nunca número negativo
    expect(textoSome(CANCELADA, 7, dia(20))).toBe('some hoje')
    expect(textoSome(CANCELADA, 1, dia(11, 16))).toBe('some amanhã')
  })
})
