import { describe, expect, it } from 'vitest'
import { juntarNaConversa, trocarNaConversa } from './conversa'
import type { CacheConversa, ItemDaConversa } from './conversa'
import { trocarMensagem } from '@/chat/consultas'
import type { MensagemChat } from '@/chat/tipos'

function item(id: number, texto: string | null = `m${id}`): ItemDaConversa {
  return {
    id,
    tipo: 'mensagem',
    autor_id: 'u1',
    autor_nome: 'Ana',
    autor_foto: null,
    texto,
    mencoes: [],
    criada_em: '2026-10-14T03:00:00Z',
    editada_em: null,
    apagada_em: null,
    editada_vezes: 0,
    resumo: null,
    tem_mais: false,
  }
}
const cache = (...paginas: ItemDaConversa[][]): CacheConversa => ({
  pages: paginas,
  pageParams: paginas.map(() => null),
})

describe('a conversa do card no cache (SESSAO-31)', () => {
  it('a mensagem nova entra no topo da 1ª página, sem repetir', () => {
    const atual = cache([item(3), item(2)], [item(1)])
    const depois = juntarNaConversa(atual, item(4))
    expect(depois?.pages[0].map((m) => m.id)).toEqual([4, 3, 2])
    expect(juntarNaConversa(depois, item(4))?.pages[0].map((m) => m.id)).toEqual([4, 3, 2])
  })

  it('a mudança (editada/apagada) troca a mensagem onde ela estiver', () => {
    const atual = cache([item(3)], [item(1)])
    const depois = trocarNaConversa(atual, {
      id: 1,
      texto: null,
      apagada_em: '2026-10-14T03:05:00Z',
    })
    expect(depois?.pages[1][0]).toMatchObject({
      id: 1,
      texto: null,
      apagada_em: '2026-10-14T03:05:00Z',
    })
    expect(depois?.pages[0][0].texto).toBe('m3')
  })
})

describe('o chat no cache (D-131)', () => {
  it('a apagada chega sem o texto: quem já tinha o texto (o admin) só ganha a marca', () => {
    const msg: MensagemChat = {
      id: 9,
      conversa_id: 1,
      autor_id: 'u1',
      autor_nome: 'Ana',
      autor_foto: null,
      tipo: 'texto',
      texto: 'oi',
      criada_em: '2026-10-14T03:00:00Z',
    }
    const atual = { pages: [[msg]], pageParams: [null] }
    const apagada = trocarMensagem(atual, {
      id: 9,
      texto: null,
      apagada_em: '2026-10-14T03:01:00Z',
    })
    expect(apagada?.pages[0][0]).toMatchObject({ texto: 'oi', apagada_em: '2026-10-14T03:01:00Z' })
    const editada = trocarMensagem(atual, {
      id: 9,
      texto: 'oi, tudo bem?',
      editada_em: '2026-10-14T03:02:00Z',
    })
    expect(editada?.pages[0][0].texto).toBe('oi, tudo bem?')
  })
})
