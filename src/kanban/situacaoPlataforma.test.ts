import { describe, expect, it } from 'vitest'
import { AJUSTES_PEDIDO, ROTULO_SITUACAO_PLATAFORMA, pedidosPorExtenso, textoDoTotal } from './situacaoPlataforma'

describe('situação do pedido na plataforma (SESSAO-30 · D-117)', () => {
  it('toda situação tem frase de gente — nunca o código', () => {
    for (const [codigo, rotulo] of Object.entries(ROTULO_SITUACAO_PLATAFORMA)) {
      expect(rotulo, codigo).not.toMatch(/_/)
      expect(rotulo.length, codigo).toBeGreaterThan(2)
    }
    expect(ROTULO_SITUACAO_PLATAFORMA.aguardo).toBe('Pronto no aguardo')
  })

  it('os três ajustes do seletor, na ordem do dono (entregue, em rota, concluído — mostrados do começo ao fim do caminho)', () => {
    expect(AJUSTES_PEDIDO.map((a) => a.valor)).toEqual(['concluido', 'em_rota', 'entregue'])
    expect(AJUSTES_PEDIDO.every((a) => a.explica.length > 20)).toBe(true)
  })

  it('o total com teto e o plural por extenso', () => {
    expect(textoDoTotal(null)).toBe('')
    expect(textoDoTotal(5432)).toBe('5.432')
    expect(textoDoTotal(10_001)).toBe('mais de 10.000')
    expect(pedidosPorExtenso(1)).toBe('1 pedido')
    expect(pedidosPorExtenso(12)).toBe('12 pedidos')
  })
})
