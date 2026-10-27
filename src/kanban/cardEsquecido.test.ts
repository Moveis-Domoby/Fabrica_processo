import { describe, expect, it } from 'vitest'
import { nomeDoEsquecido, textoDaResposta } from './cardEsquecido'

describe('card esquecido (SESSAO-41 — a pergunta "ainda tem alguém?")', () => {
  it('o nome leva o número do pedido quando o card é de pedido', () => {
    expect(nomeDoEsquecido({ nome: 'Rack Paris', pedido: 13660 })).toBe('Rack Paris · pedido 13660')
    expect(nomeDoEsquecido({ nome: 'Gabarito novo', pedido: null })).toBe('Gabarito novo')
  })

  it('a resposta vira uma frase de gente', () => {
    const proximo = new Date(2026, 9, 27, 16, 5).toISOString()
    const pausado = new Date(2026, 9, 27, 14, 5).toISOString()
    expect(textoDaResposta({ situacao: 'seguiu', proximo_aviso: proximo })).toContain('16:05')
    expect(textoDaResposta({ situacao: 'pausado', pausado_em: pausado })).toContain('14:05')
    expect(textoDaResposta({ situacao: 'pausado', pausado_em: pausado })).toContain(
      'não conta como trabalho',
    )
    expect(textoDaResposta({ situacao: 'respondido' })).toContain('já respondeu')
  })
})
