import { describe, expect, it } from 'vitest'
import { nomeDoCard } from './rotulos'

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
