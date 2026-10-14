import type { InfiniteData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * SESSAO-31 (§3 · D-131): a conversa do card — a mensagem é FATO do card;
 * editar e apagar são fatos novos (nada se apaga). 10 por página por cursor;
 * ao vivo pelo canal privado do card (plt-card:{id}).
 */
export interface ItemDaConversa {
  id: number
  /** 'mensagem' ou o tipo do fato do card (no filtro "Tudo"). */
  tipo: string
  autor_id: string | null
  autor_nome: string
  autor_foto: string | null
  /** Nulo na apagada (o admin vê o texto). */
  texto: string | null
  mencoes: { id: string; nome: string }[]
  criada_em: string
  editada_em: string | null
  apagada_em: string | null
  editada_vezes: number
  resumo: Record<string, unknown> | null
  tem_mais: boolean
}

export type CacheConversa = InfiniteData<ItemDaConversa[], number | null>

export const topicoDoCard = (cardId: number) => `plt-card:${cardId}`
export const chaveDaConversa = (cardId: number, tudo: boolean) =>
  ['card-mensagens', cardId, tudo] as const

export async function listarConversa(
  cardId: number,
  antesId: number | null,
  tudo: boolean,
): Promise<ItemDaConversa[]> {
  const { data, error } = await supabase.rpc('plt_fn_card_mensagens', {
    p_card_id: cardId,
    p_antes_id: antesId,
    p_limite: 10,
    p_tudo: tudo,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as ItemDaConversa[]
}

export async function mandarMensagemNoCard(parametros: {
  cardId: number
  texto: string
  mencoes: string[]
  chave: string
}): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_card_comentar', {
    p_card_id: parametros.cardId,
    p_texto: parametros.texto,
    p_mencoes: parametros.mencoes.length > 0 ? parametros.mencoes : null,
    p_chave: parametros.chave,
    p_operador_id: null,
  })
  if (error) throw new Error(error.message)
  return data as number
}

export async function editarMensagemDoCard(mensagemId: number, texto: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_card_mensagem_editar', {
    p_mensagem_id: mensagemId,
    p_texto: texto,
  })
  if (error) throw new Error(error.message)
}

export async function apagarMensagemDoCard(mensagemId: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_card_mensagem_apagar', { p_mensagem_id: mensagemId })
  if (error) throw new Error(error.message)
}

export async function versoesDaMensagemDoCard(
  mensagemId: number,
): Promise<{ texto: string; trocada_por: string | null; trocada_em: string }[]> {
  const { data, error } = await supabase.rpc('plt_fn_card_mensagem_versoes', {
    p_mensagem_id: mensagemId,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as { texto: string; trocada_por: string | null; trocada_em: string }[]
}

/** Põe o item novo no topo da 1ª página (sem repetir). Lógica pura. */
export function juntarNaConversa(
  atual: CacheConversa | undefined,
  novo: ItemDaConversa,
): CacheConversa | undefined {
  if (!atual || atual.pages.length === 0) return atual
  if (atual.pages.some((p) => p.some((m) => m.id === novo.id))) return trocarNaConversa(atual, novo)
  const [primeira, ...resto] = atual.pages
  return { ...atual, pages: [[novo, ...primeira], ...resto] }
}

/** Troca um item já mostrado (editada/apagada). Lógica pura. */
export function trocarNaConversa(
  atual: CacheConversa | undefined,
  mudanca: Partial<ItemDaConversa> & { id: number },
): CacheConversa | undefined {
  if (!atual) return atual
  return {
    ...atual,
    pages: atual.pages.map((p) => p.map((m) => (m.id === mudanca.id ? { ...m, ...mudanca } : m))),
  }
}
