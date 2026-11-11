import { describe, expect, it, vi } from 'vitest'

/**
 * SESSAO-48 (frente 3): a lógica pura da janela "Para onde vai este móvel?" —
 * as vagas que as peças iguais dividem, a distribuição do "todas de uma vez",
 * as frases do que já foi decidido e o pedido mandado ao banco.
 */
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }))

import {
  decidirDestino,
  distribuirOutroPedido,
  nomeDaPeca,
  textoDaDecisao,
  vagasQueSobram,
} from './destino'
import type { PedidoCandidato } from './destino'

const cand = (pedido_id: number, numero: number, vagas: number): PedidoCandidato => ({
  pedido_id,
  card_pedido_id: pedido_id + 1000,
  numero,
  cliente_nome: `Cliente ${numero}`,
  data_prevista: null,
  vagas,
  standby: false,
})

describe('distribuirOutroPedido — "todas de uma vez" para outro pedido', () => {
  it('as peças iguais dividem as vagas: o mais antigo primeiro, até encher', () => {
    const pecas = [
      { id: 1, chave: 'p:1', danificada: false },
      { id: 2, chave: 'p:1', danificada: false },
      { id: 3, chave: 'p:1', danificada: false },
    ]
    const candidatos = { 'p:1': [cand(10, 13710, 2), cand(11, 13711, 1)] }
    expect(distribuirOutroPedido(pecas, candidatos)).toEqual({ 1: 10, 2: 10, 3: 11 })
  })

  it('nulo quando sobra peça sem pedido (vagas acabaram, sem candidato ou danificada)', () => {
    const candidatos = { 'p:1': [cand(10, 13710, 1)] }
    expect(
      distribuirOutroPedido(
        [
          { id: 1, chave: 'p:1', danificada: false },
          { id: 2, chave: 'p:1', danificada: false },
        ],
        candidatos,
      ),
    ).toBeNull()
    expect(distribuirOutroPedido([{ id: 1, chave: 'p:2', danificada: false }], candidatos)).toBeNull()
    expect(distribuirOutroPedido([{ id: 1, chave: 'p:1', danificada: true }], candidatos)).toBeNull()
  })
})

describe('vagasQueSobram — a vaga que outra peça da janela já escolheu não aparece livre', () => {
  it('desconta só as peças IGUAIS que escolheram o MESMO pedido', () => {
    const pecas = [
      { id: 1, chave: 'p:1' },
      { id: 2, chave: 'p:1' },
      { id: 3, chave: 'p:2' },
    ]
    const escolhas = {
      1: { destino: 'outro_pedido' as const, pedidoId: 10 },
      3: { destino: 'outro_pedido' as const, pedidoId: 10 },
    }
    expect(vagasQueSobram(cand(10, 13710, 1), 'p:1', 2, escolhas, pecas)).toBe(0)
    expect(vagasQueSobram(cand(10, 13710, 2), 'p:1', 2, escolhas, pecas)).toBe(1)
    // a própria escolha não conta contra ela
    expect(vagasQueSobram(cand(10, 13710, 1), 'p:1', 1, escolhas, pecas)).toBe(1)
  })
})

describe('as frases', () => {
  it('o que aconteceu com a peça, em língua de gente', () => {
    const base = { via: null, automatico: false, numero_destino: null }
    expect(textoDaDecisao({ ...base, destino: 'estoque' })).toBe('Seguiu para o estoque')
    expect(textoDaDecisao({ ...base, destino: 'estoque', automatico: true })).toBe(
      'Ficou pronto sem decisão — entrou no ESTOQUE sem dono',
    )
    expect(textoDaDecisao({ ...base, destino: 'outro_pedido', numero_destino: 13710, via: 'logistica' })).toBe(
      'Passou para o pedido 13710',
    )
    expect(textoDaDecisao({ ...base, destino: 'outro_pedido', numero_destino: 13710, via: 'pcp' })).toBe(
      'Passou para o pedido 13710 (pelo PCP)',
    )
    expect(textoDaDecisao({ ...base, destino: 'cancelar' })).toBe('Fabricação cancelada')
    expect(textoDaDecisao({ ...base, destino: 'descancelado' })).toBe(
      'O pedido voltou a valer no Tiny — o móvel seguiu com ele',
    )
  })

  it('o nome da peça leva o k/n', () => {
    expect(nomeDaPeca({ descricao: 'Cômoda', indice: 1, total: 2 })).toBe('Cômoda (1/2)')
    expect(nomeDaPeca({ descricao: '  ', indice: null, total: null })).toBe('Móvel')
  })
})

describe('decidirDestino — o pedido ao banco', () => {
  it('manda peça, destino e, só em "outro pedido", o pedido escolhido', async () => {
    rpc.mockResolvedValueOnce({ data: { numero: 13702, decididas: 2, feitas: [], puladas: [] }, error: null })
    await decidirDestino(31, [
      { pecaId: 1, destino: 'estoque', pedidoId: 99 },
      { pecaId: 2, destino: 'outro_pedido', pedidoId: 10 },
      { pecaId: 3, destino: 'cancelar' },
    ])
    expect(rpc).toHaveBeenCalledWith('plt_fn_destino_decidir', {
      p_card_id: 31,
      p_decisoes: [
        { peca_id: 1, destino: 'estoque' },
        { peca_id: 2, destino: 'outro_pedido', pedido_id: 10 },
        { peca_id: 3, destino: 'cancelar' },
      ],
    })
  })

  it('a recusa do banco chega como mensagem em português', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'O pedido 13710 não está mais no PCP' } })
    await expect(decidirDestino(31, [{ pecaId: 1, destino: 'estoque' }])).rejects.toThrow(
      'Não deu para aplicar a decisão: O pedido 13710 não está mais no PCP',
    )
  })
})
