import type { InfiniteData } from '@tanstack/react-query'
import type { ConversaResumo, CursorConversas, PaginaConversas, SinalMensagem } from './tipos'

/**
 * O cache da lista de conversas e o que o websocket faz com ele (SESSAO-26).
 * Lógica pura: o sinal que chega pelo canal da pessoa ATUALIZA a lista e o
 * badge sem reler o banco (lei do dono: leitura só por página). Quando o
 * sinal fala de uma conversa que não está nas páginas carregadas, quem chama
 * relê a 1ª página — é o único caso.
 */
export type CacheConversas = InfiniteData<PaginaConversas, CursorConversas | null>

export const TETO_NAO_LIDAS = 100

export function acharConversa(
  cache: CacheConversas | undefined,
  conversaId: number,
): ConversaResumo | undefined {
  for (const pagina of cache?.pages ?? []) {
    const achada = pagina.itens.find((c) => c.conversa_id === conversaId)
    if (achada) return achada
  }
  return undefined
}

export function totalNaoLidas(cache: CacheConversas | undefined): number {
  return cache?.pages[0]?.totalNaoLidas ?? 0
}

function comTotal(cache: CacheConversas, delta: number): CacheConversas {
  if (delta === 0 || cache.pages.length === 0) return cache
  const [primeira, ...resto] = cache.pages
  return {
    ...cache,
    pages: [
      { ...primeira, totalNaoLidas: Math.max(0, (primeira.totalNaoLidas ?? 0) + delta) },
      ...resto,
    ],
  }
}

function semConversa(cache: CacheConversas, conversaId: number): CacheConversas {
  return {
    ...cache,
    pages: cache.pages.map((p) => ({
      ...p,
      itens: p.itens.filter((c) => c.conversa_id !== conversaId),
    })),
  }
}

/**
 * Mensagem nova numa conversa: ela sobe para o topo com a prévia, e — se não
 * é minha e a conversa não está aberta na tela — soma 1 na não lida e no
 * total. Devolve `achada: false` quando a conversa não está no cache.
 */
export function aplicarMensagemNova(
  cache: CacheConversas,
  sinal: SinalMensagem,
  contexto: { eu: string; visivel: boolean },
): { cache: CacheConversas; achada: boolean } {
  const atual = acharConversa(cache, sinal.conversa_id)
  if (!atual) return { cache, achada: false }
  if (atual.ultima_id !== null && sinal.mensagem_id <= atual.ultima_id) {
    return { cache, achada: true } // sinal repetido ou atrasado: já está aplicado
  }
  const minha = sinal.autor_id === contexto.eu
  const conta = !minha && !contexto.visivel && sinal.mensagem_id > atual.ultima_lida_id
  const atualizada: ConversaResumo = {
    ...atual,
    atividade_em: sinal.criada_em,
    ultima_id: sinal.mensagem_id,
    ultima_previa: sinal.previa,
    ultima_autor_id: sinal.autor_id,
    ultima_autor_nome: sinal.autor_nome,
    ultima_lida_id: minha ? Math.max(atual.ultima_lida_id, sinal.mensagem_id) : atual.ultima_lida_id,
    nao_lidas: conta ? Math.min(TETO_NAO_LIDAS, atual.nao_lidas + 1) : atual.nao_lidas,
  }
  const limpo = semConversa(cache, sinal.conversa_id)
  const [primeira, ...resto] = limpo.pages
  const reordenado: CacheConversas = {
    ...limpo,
    pages: [{ ...primeira, itens: [atualizada, ...primeira.itens] }, ...resto],
  }
  return { cache: comTotal(reordenado, conta ? 1 : 0), achada: true }
}

/**
 * Lida até `ultimaLidaId` (aqui ou noutra aba): o ponteiro só anda para
 * frente; lida até a última, zera a não lida e desconta do total.
 */
export function aplicarLida(
  cache: CacheConversas,
  conversaId: number,
  ultimaLidaId: number,
): CacheConversas {
  const atual = acharConversa(cache, conversaId)
  if (!atual || ultimaLidaId <= atual.ultima_lida_id) return cache
  const zerou = ultimaLidaId >= (atual.ultima_id ?? 0)
  const desconto = zerou ? atual.nao_lidas : 0
  const paginas = cache.pages.map((p) => ({
    ...p,
    itens: p.itens.map((c) =>
      c.conversa_id === conversaId
        ? { ...c, ultima_lida_id: ultimaLidaId, nao_lidas: zerou ? 0 : c.nao_lidas }
        : c,
    ),
  }))
  return comTotal({ ...cache, pages: paginas }, -desconto)
}

/** Tirado do canal: some da lista e as não lidas dela saem do total. */
export function removerConversa(cache: CacheConversas, conversaId: number): CacheConversas {
  const atual = acharConversa(cache, conversaId)
  if (!atual) return cache
  return comTotal(semConversa(cache, conversaId), -atual.nao_lidas)
}

/** Troca um campo da conversa no lugar (nome novo, permissão de escrever). */
export function atualizarConversa(
  cache: CacheConversas,
  conversaId: number,
  mudanca: Partial<ConversaResumo>,
): CacheConversas {
  if (!acharConversa(cache, conversaId)) return cache
  return {
    ...cache,
    pages: cache.pages.map((p) => ({
      ...p,
      itens: p.itens.map((c) => (c.conversa_id === conversaId ? { ...c, ...mudanca } : c)),
    })),
  }
}

/** "99+" a partir de 100 — o banco conta até 100 e para (teto). */
export function rotuloContagem(n: number): string {
  return n > 99 ? '99+' : String(n)
}
