import { describe, expect, it } from 'vitest'
import {
  acharConversa,
  aplicarLida,
  aplicarMensagemNova,
  atualizarConversa,
  removerConversa,
  rotuloContagem,
  totalNaoLidas,
} from './cache'
import type { CacheConversas } from './cache'
import type { ConversaResumo, SinalMensagem } from './tipos'

const EU = 'eu-uuid'

function conversa(id: number, parcial: Partial<ConversaResumo> = {}): ConversaResumo {
  return {
    conversa_id: id,
    tipo: 'canal',
    titulo: `Canal ${id}`,
    foto_caminho: null,
    outro_id: null,
    outro_ativo: null,
    papel: 'membro',
    pode_escrever: true,
    administra: false,
    membros: 3,
    atividade_em: '2026-09-27T10:00:00Z',
    ultima_id: id * 10,
    ultima_previa: 'oi',
    ultima_autor_id: 'outra',
    ultima_autor_nome: 'Outra Pessoa',
    ultima_lida_id: id * 10,
    nao_lidas: 0,
    total_nao_lidas: null,
    ...parcial,
  }
}

function cache(paginas: ConversaResumo[][], total = 0): CacheConversas {
  return {
    pageParams: paginas.map((_, i) => (i === 0 ? null : { em: 'x', id: i })),
    pages: paginas.map((itens, i) => ({ itens, totalNaoLidas: i === 0 ? total : null, proximo: null })),
  }
}

function sinal(parcial: Partial<SinalMensagem>): SinalMensagem {
  return {
    conversa_id: 1,
    tipo_conversa: 'canal',
    nome_conversa: 'Canal 1',
    mensagem_id: 999,
    autor_id: 'outra',
    autor_nome: 'Outra Pessoa',
    autor_foto: null,
    previa: 'mensagem nova',
    criada_em: '2026-09-27T12:00:00Z',
    ...parcial,
  }
}

describe('aplicarMensagemNova — o websocket atualiza a lista sem reler', () => {
  it('sobe a conversa para o topo da 1ª página, com a prévia, e soma 1 na não lida e no total', () => {
    const inicial = cache([[conversa(5), conversa(4)], [conversa(3), conversa(2)]], 0)
    const { cache: depois, achada } = aplicarMensagemNova(inicial, sinal({ conversa_id: 3 }), {
      eu: EU,
      visivel: false,
    })
    expect(achada).toBe(true)
    expect(depois.pages[0].itens.map((c) => c.conversa_id)).toEqual([3, 5, 4])
    expect(depois.pages[1].itens.map((c) => c.conversa_id)).toEqual([2])
    const c3 = acharConversa(depois, 3)!
    expect(c3.ultima_previa).toBe('mensagem nova')
    expect(c3.nao_lidas).toBe(1)
    expect(totalNaoLidas(depois)).toBe(1)
  })

  it('mensagem MINHA não conta como não lida e adianta o meu ponteiro', () => {
    const { cache: depois } = aplicarMensagemNova(cache([[conversa(1)]]), sinal({ autor_id: EU }), {
      eu: EU,
      visivel: false,
    })
    expect(acharConversa(depois, 1)!.nao_lidas).toBe(0)
    expect(acharConversa(depois, 1)!.ultima_lida_id).toBe(999)
    expect(totalNaoLidas(depois)).toBe(0)
  })

  it('conversa aberta e à vista: não vira não lida', () => {
    const { cache: depois } = aplicarMensagemNova(cache([[conversa(1)]]), sinal({}), {
      eu: EU,
      visivel: true,
    })
    expect(acharConversa(depois, 1)!.nao_lidas).toBe(0)
    expect(totalNaoLidas(depois)).toBe(0)
  })

  it('sinal repetido (mesma mensagem) não conta duas vezes', () => {
    const uma = aplicarMensagemNova(cache([[conversa(1)]]), sinal({}), { eu: EU, visivel: false }).cache
    const duas = aplicarMensagemNova(uma, sinal({}), { eu: EU, visivel: false }).cache
    expect(acharConversa(duas, 1)!.nao_lidas).toBe(1)
    expect(totalNaoLidas(duas)).toBe(1)
  })

  it('conversa fora das páginas carregadas: avisa quem chama para reler a 1ª página', () => {
    const inicial = cache([[conversa(1)]])
    const { cache: depois, achada } = aplicarMensagemNova(inicial, sinal({ conversa_id: 77 }), {
      eu: EU,
      visivel: false,
    })
    expect(achada).toBe(false)
    expect(depois).toBe(inicial)
  })

  it('a não lida tem teto de 100 (o badge mostra "99+")', () => {
    const cheia = cache([[conversa(1, { nao_lidas: 100 })]], 100)
    const { cache: depois } = aplicarMensagemNova(cheia, sinal({}), { eu: EU, visivel: false })
    expect(acharConversa(depois, 1)!.nao_lidas).toBe(100)
    expect(rotuloContagem(100)).toBe('99+')
    expect(rotuloContagem(7)).toBe('7')
  })
})

describe('aplicarLida / removerConversa / atualizarConversa', () => {
  it('lida até a última zera a conversa e desconta do total; o ponteiro nunca volta', () => {
    const inicial = cache([[conversa(1, { ultima_id: 50, ultima_lida_id: 40, nao_lidas: 3 })]], 5)
    const lida = aplicarLida(inicial, 1, 50)
    expect(acharConversa(lida, 1)!.nao_lidas).toBe(0)
    expect(totalNaoLidas(lida)).toBe(2)
    expect(aplicarLida(lida, 1, 45)).toBe(lida)
  })

  it('tirado do canal: a conversa some e as não lidas dela saem do total', () => {
    const inicial = cache([[conversa(1, { nao_lidas: 2 }), conversa(2)]], 2)
    const depois = removerConversa(inicial, 1)
    expect(acharConversa(depois, 1)).toBeUndefined()
    expect(totalNaoLidas(depois)).toBe(0)
  })

  it('nome novo e permissão mudam no lugar', () => {
    const depois = atualizarConversa(cache([[conversa(1)]]), 1, { titulo: 'Montagem', pode_escrever: false })
    expect(acharConversa(depois, 1)).toMatchObject({ titulo: 'Montagem', pode_escrever: false })
  })
})
