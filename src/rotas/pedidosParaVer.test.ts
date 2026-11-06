import { describe, expect, it } from 'vitest'
import { pedidosParaVer } from './pedidosParaVer'
import type { PedidoProgramacao } from './api'
import type { ItemAvulsa } from './paradasAvulsas'

const pedido = {
  card_id: 7,
  numero: 13745,
  endereco: 'Av. Xavier da Silveira',
  numero_endereco: '940',
  bairro: 'Morro Branco',
  cidade: 'Natal',
  uf: 'RN',
  data_prevista: '2026-10-28',
} as unknown as PedidoProgramacao

const avulsa: ItemAvulsa = {
  card_id: -1,
  ordem: null,
  latitude: null,
  longitude: null,
  total_unidades: 0,
  avulsa: {
    chave: 'k1',
    titulo: 'Buscar material',
    endereco: ' ',
    latitude: null,
    longitude: null,
    observacao: null,
  },
}

describe('pedidosParaVer — a lista curta do mapa em tela cheia (06/11)', () => {
  it('pedido: número, endereço legível e a data de entrega; na ordem da rota', () => {
    const [a, b] = pedidosParaVer([pedido, avulsa])
    expect(a).toEqual({
      chave: 7,
      titulo: 'Pedido 13745',
      endereco: 'Av. Xavier da Silveira, 940 · Morro Branco · Natal-RN',
      entrega: new Date('2026-10-28T00:00:00').toLocaleDateString('pt-BR'),
    })
    expect(b).toEqual({
      chave: -1,
      titulo: 'Parada avulsa · Buscar material',
      endereco: 'Sem endereço cadastrado',
      entrega: null,
    })
  })

  it('pedido sem data prevista não inventa data', () => {
    const [a] = pedidosParaVer([{ ...pedido, data_prevista: null }])
    expect(a.entrega).toBeNull()
  })
})
