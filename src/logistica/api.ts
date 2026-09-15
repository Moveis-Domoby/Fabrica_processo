import { supabase } from '@/lib/supabase'
import type { Estado } from '@/componentes/ui'

/**
 * Camada de dados da Logística (SESSAO-15 / D-38 / D-45): Estoque, Pedidos
 * em aguardo e Danificados. Tudo passa pelas portas plt_fn_* (gate da
 * logística DENTRO do banco); todo gesto vira evento append-only ou registro
 * na trilha de atividade — nada aqui faz UPDATE de posição.
 */

function garantir<T>(dados: T | null, erro: { message: string } | null, contexto: string): T {
  if (erro) throw new Error(`${contexto}: ${erro.message}`)
  if (dados === null) throw new Error(`${contexto}: o servidor não devolveu dados.`)
  return dados
}

// ---------------------------------------------------------------------------
// Estoque (D-38): unidades paradas com ID de produção digitável
// ---------------------------------------------------------------------------

export interface LinhaEstoque {
  card_id: number
  id_producao: string | null
  item_codigo: string | null
  item_descricao: string | null
  indice_unidade: number | null
  total_unidades: number | null
  pedido_id: number
  numero: number
  /** 'pedido' hoje; "produção para estoque" fica para quando a Q-23 for decidida. */
  origem: 'pedido' | 'producao_para_estoque'
  qualidade_atual: Estado | null
  desde: string | null
  contagem_total: number
}

export async function listarEstoque(parametros: {
  busca?: string
  limite?: number
  deslocamento?: number
}): Promise<LinhaEstoque[]> {
  const { data, error } = await supabase.rpc('plt_fn_estoque', {
    p_busca: parametros.busca || null,
    p_limite: parametros.limite ?? 20,
    p_deslocamento: parametros.deslocamento ?? 0,
  })
  return garantir(data as LinhaEstoque[] | null, error, 'Não deu para carregar o estoque')
}

/** O ID de produção: formato livre (Q-63 aberta), único entre unidades vivas. */
export async function definirIdProducao(cardId: number, idProducao: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_definir_id_producao', {
    p_card_id: cardId,
    p_id_producao: idProducao,
  })
  if (error) throw new Error(`Não deu para gravar o ID: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Pedidos em aguardo (D-38/D-45): unidades prontas esperando o pedido completar
// ---------------------------------------------------------------------------

export interface PedidoAguardo {
  card_id: number
  pedido_id: number
  numero: number
  cliente_nome: string
  data_prevista: string | null
  situacao: string | null
  total_unidades: number
  unidades_liberadas: number
  unidades_prontas: number
  completo: boolean
  alterado_apos_liberacao: boolean
  contagem_total: number
}

export async function listarPedidosAguardo(parametros: {
  busca?: string
  limite?: number
  deslocamento?: number
}): Promise<PedidoAguardo[]> {
  const { data, error } = await supabase.rpc('plt_fn_pedidos_aguardo', {
    p_busca: parametros.busca || null,
    p_limite: parametros.limite ?? 20,
    p_deslocamento: parametros.deslocamento ?? 0,
  })
  return garantir(data as PedidoAguardo[] | null, error, 'Não deu para carregar os pedidos em aguardo')
}

/**
 * Lançar para ROTAS (D-45): evento no card do pedido + as unidades saem do
 * ESTOQUE para o setor ROTAS numa transação. O banco recusa pedido incompleto.
 */
export async function lancarParaRotas(cardPedidoId: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_lancar_rotas', { p_card_id: cardPedidoId })
  if (error) throw new Error(`Não deu para lançar: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Danificados (D-38/D-45)
// ---------------------------------------------------------------------------

export interface Danificado {
  card_id: number
  pedido_id: number
  numero: number
  item_codigo: string | null
  item_descricao: string | null
  indice_unidade: number | null
  total_unidades: number | null
  setor_id: number
  setor_nome: string
  etapa_nome: string
  qualidade_atual: Estado | null
  desde: string | null
  arquivado_em: string | null
  /** O setor que entregou a peça marcada (D-09). */
  origem_setor_nome: string | null
  marcacao_estado: Estado | null
  marcacao_por: string | null
  marcacao_obs: string | null
  marcado_em: string | null
  parecer_estado: Estado | null
  parecer_por: string | null
  parecer_obs: string | null
  contagem_total: number
}

export async function listarDanificados(parametros: {
  arquivados?: boolean
  busca?: string
  limite?: number
  deslocamento?: number
}): Promise<Danificado[]> {
  const { data, error } = await supabase.rpc('plt_fn_danificados', {
    p_arquivados: parametros.arquivados ?? false,
    p_busca: parametros.busca || null,
    p_limite: parametros.limite ?? 20,
    p_deslocamento: parametros.deslocamento ?? 0,
  })
  return garantir(data as Danificado[] | null, error, 'Não deu para carregar os danificados')
}

/**
 * Resolvido → destino (D-45): Estoque, ROTAS ou qualquer setor. Para OUTRO
 * setor o estado é obrigatório (o banco recusa sem ele); no mesmo setor é só
 * mudança de etapa.
 */
export async function resolverDanificado(parametros: {
  cardId: number
  destinoSetorId: number
  destinoEtapaId?: number | null
  estado?: Estado | null
  observacao?: string
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_resolver_danificado', {
    p_card_id: parametros.cardId,
    p_setor_destino_id: parametros.destinoSetorId,
    // `|| null`: id 0/NaN nunca é etapa válida.
    p_etapa_destino_id: parametros.destinoEtapaId || null,
    p_estado_qualidade: parametros.estado ?? null,
    p_observacao: parametros.observacao?.trim() || null,
  })
  if (error) throw new Error(`Não deu para resolver: ${error.message}`)
}

/** Arquivar (exclusão lógica): sai da lista, fica na história. */
export async function arquivarCard(cardId: number, observacao?: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_arquivar_card', {
    p_card_id: cardId,
    p_observacao: observacao?.trim() || null,
  })
  if (error) throw new Error(`Não deu para arquivar: ${error.message}`)
}
