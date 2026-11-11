import { describe, expect, it } from 'vitest'
import { nomeDoCard, rotuloOrigemCard } from './rotulos'

/** Validação no site (15/10): a janela do card do pedido dizia "Sem descrição". */
describe('o nome do card', () => {
  it('o card do pedido não vira "Sem descrição"', () => {
    expect(nomeDoCard({ tipo: 'pedido', item_descricao: null })).toBe('Card do pedido')
    expect(nomeDoCard({ tipo: 'unidade', item_descricao: 'Armário multiuso' })).toBe(
      'Armário multiuso',
    )
    expect(nomeDoCard({ tipo: 'avulso', item_descricao: null, titulo: 'Trocar a lâmpada' })).toBe(
      'Trocar a lâmpada',
    )
  })
})

describe('a origem da peça cancelada (SESSAO-48)', () => {
  it('a peça que perdeu o pedido ao ser cancelada diz de qual era — não é reposição', () => {
    expect(rotuloOrigemCard({ pedido_id: null, tipo: 'unidade', cancelada_pedido_numero: 13622 })).toBe('Era do pedido 13622')
    expect(rotuloOrigemCard({ pedido_id: null, tipo: 'unidade', cancelada_pedido_numero: null })).toBe('Reposição de estoque')
  })
})
