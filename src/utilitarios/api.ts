import { supabase } from '@/lib/supabase'
import type { Motivo, TipoMotivo } from '@/rotas/api'
import { ehCorEtiqueta } from './tipos'
import type { CampoCustomizado, Etiqueta, TipoCampo, ValorCampo, ValorDeCampo } from './tipos'

/**
 * Etiquetas e campos customizados (SESSAO-27 · D-101). Os catálogos são
 * pequenos e ficam em cache com UMA chave cada (E-22: um dado, um fetcher):
 * ['etiquetas'] e ['campos'] — com as arquivadas, cada tela filtra o que mostra.
 */

export async function buscarEtiquetas(): Promise<Etiqueta[]> {
  const { data, error } = await supabase
    .from('plt_etiquetas')
    .select('id, nome, cor, arquivada_em')
    .order('nome')
  if (error) throw new Error(`Não deu para carregar as etiquetas: ${error.message}`)
  return ((data ?? []) as Etiqueta[]).map((e) => ({
    ...e,
    cor: ehCorEtiqueta(e.cor) ? e.cor : 'cinza',
  }))
}

export async function salvarEtiqueta(parametros: {
  id: number | null
  nome: string
  cor: string
}): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_etiqueta_salvar', {
    p_id: parametros.id,
    p_nome: parametros.nome,
    p_cor: parametros.cor,
  })
  if (error) throw new Error(error.message)
  return data as number
}

export async function arquivarEtiqueta(id: number, arquivar: boolean): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_etiqueta_arquivar', {
    p_id: id,
    p_arquivar: arquivar,
  })
  if (error) throw new Error(error.message)
}

export async function excluirEtiqueta(id: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_etiqueta_excluir', { p_id: id })
  if (error) throw new Error(error.message)
}

export async function buscarCampos(): Promise<CampoCustomizado[]> {
  const { data, error } = await supabase
    .from('plt_campos')
    .select('id, nome, tipo, opcoes, em_pecas, em_pedidos, em_avulsos, arquivado_em')
    .order('nome')
  if (error) throw new Error(`Não deu para carregar os campos: ${error.message}`)
  return (data ?? []) as CampoCustomizado[]
}

export async function salvarCampo(parametros: {
  id: number | null
  nome: string
  tipo: TipoCampo
  opcoes: string[]
  emPecas: boolean
  emPedidos: boolean
  /** SESSAO-31 (↩️ D-101): vale também nos cards avulsos. */
  emAvulsos?: boolean
}): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_campo_salvar', {
    p_id: parametros.id,
    p_nome: parametros.nome,
    p_tipo: parametros.tipo,
    p_opcoes: parametros.opcoes,
    p_em_pecas: parametros.emPecas,
    p_em_pedidos: parametros.emPedidos,
    p_em_avulsos: parametros.emAvulsos ?? false,
  })
  if (error) throw new Error(error.message)
  return data as number
}

export async function arquivarCampo(id: number, arquivar: boolean): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_campo_arquivar', { p_id: id, p_arquivar: arquivar })
  if (error) throw new Error(error.message)
}

export async function excluirCampo(id: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_campo_excluir', { p_id: id })
  if (error) throw new Error(error.message)
}

/**
 * Os valores dos campos SÓ dos cards/pedidos que a tela mostra (regra 17):
 * peças por `card_id`, pedidos por `pedido_id`.
 */
export async function buscarValoresCampos(parametros: {
  cardIds?: number[]
  pedidoIds?: number[]
}): Promise<ValorDeCampo[]> {
  const cardIds = parametros.cardIds ?? []
  const pedidoIds = parametros.pedidoIds ?? []
  if (cardIds.length === 0 && pedidoIds.length === 0) return []
  const filtros: string[] = []
  if (cardIds.length > 0) filtros.push(`card_id.in.(${cardIds.join(',')})`)
  if (pedidoIds.length > 0) filtros.push(`pedido_id.in.(${pedidoIds.join(',')})`)
  const { data, error } = await supabase
    .from('plt_campos_valores')
    .select('campo_id, card_id, pedido_id, valor')
    .or(filtros.join(','))
  if (error) throw new Error(`Não deu para carregar os campos: ${error.message}`)
  return (data ?? []) as ValorDeCampo[]
}

/** As etiquetas dos cards mostrados (para telas cuja porta não traz a coluna — o PCP). */
export async function buscarEtiquetasDosCards(
  cardIds: number[],
): Promise<{ id: number; etiquetas: number[] }[]> {
  if (cardIds.length === 0) return []
  const { data, error } = await supabase.from('plt_cards').select('id, etiquetas').in('id', cardIds)
  if (error) throw new Error(`Não deu para carregar as etiquetas: ${error.message}`)
  return (data ?? []) as { id: number; etiquetas: number[] }[]
}

/** O admin preenche (ou limpa, com `valor` nulo) um campo no card ou no pedido. */
export async function definirCampo(parametros: {
  campoId: number
  cardId?: number | null
  pedidoId?: number | null
  valor: ValorCampo | null
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_campo_definir', {
    p_campo_id: parametros.campoId,
    p_card_id: parametros.cardId ?? null,
    p_pedido_id: parametros.pedidoId ?? null,
    p_valor: parametros.valor,
  })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// SESSAO-38 (D-164): os motivos de pausa ESPECIAIS — enquanto a pessoa está
// parada por um deles, o tempo não conta contra ela. A marca só existe aqui,
// em Configurações → Utilitários (só admin): a lista que o funcionário recebe
// ao pausar (plt_fn_motivos) não traz a marca — para ele é um motivo comum.
// ---------------------------------------------------------------------------

export interface MotivoComMarca extends Motivo {
  especial: boolean
}

/** Os motivos de uma lista com os desligados e a marca "especial" (só admin). */
export async function listarMotivosComMarca(tipo: TipoMotivo): Promise<MotivoComMarca[]> {
  const { data, error } = await supabase.rpc('plt_fn_motivos_config', { p_tipo: tipo })
  if (error) throw new Error(`Não deu para carregar os motivos: ${error.message}`)
  return ((data ?? []) as MotivoComMarca[]).map((m) => ({ ...m, especial: Boolean(m.especial) }))
}

/** Salvar um motivo de pausa com a marca (nulo = não mexe na marca). */
export async function salvarMotivoComMarca(parametros: {
  id: number | null
  tipo: TipoMotivo
  texto: string
  ordem?: number | null
  ativo?: boolean
  especial?: boolean | null
}): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_motivo_salvar', {
    p_id: parametros.id,
    p_tipo: parametros.tipo,
    p_texto: parametros.texto.trim(),
    p_ordem: parametros.ordem ?? null,
    p_ativo: parametros.ativo ?? true,
    p_especial: parametros.especial ?? null,
  })
  if (error) throw new Error(error.message)
  return Number(data)
}

/** O admin traz de volta um card arquivado (evento "trazido de volta"). */
export async function desarquivarCard(cardId: number, observacao?: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_desarquivar_card', {
    p_card_id: cardId,
    p_observacao: observacao ?? null,
  })
  if (error) throw new Error(error.message)
}
