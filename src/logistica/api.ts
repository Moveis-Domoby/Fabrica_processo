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
// Estoque (SESSAO-25): por PRODUTO — saldo do Tiny, reservas da loja, prontos
// reservados × livres, mínimo e a reposição. O saldo é leitura derivada do
// último aviso do Tiny (nada guardado); o disponível desconta os pedidos da
// loja ainda abertos; negativo vira "necessidade extrema" (a tela mostra 0).
// ---------------------------------------------------------------------------

/** Os dois grupos da tela (resposta 8 do dono). */
export type GrupoEstoque = 'acabados' | 'insumos'

/** Filtros da lista por produto — todos resolvidos NO SERVIDOR (regra 17). */
export type FiltroEstoque = 'abaixo_minimo' | 'extrema' | 'reservados' | 'livres' | 'sem_leitura'

/** Onde está o card de reposição mais recente do produto. */
export type EstadoReposicao = 'no_pcp' | 'em_producao' | 'concluida' | 'arquivada'

export interface LinhaEstoqueProduto {
  tiny_id: number
  codigo: string | null
  descricao: string
  classe: string | null
  unidade: string | null
  minimo: number | null
  /** Último saldo lido do Tiny (cru — pode ser negativo). Nulo = nunca houve leitura. */
  saldo_tiny: number | null
  lido_em: string | null
  origem_leitura: string | null
  /** Itens de pedidos da loja ainda abertos (reserva) — o "débito" da venda. */
  reservas_loja: number
  /** Disponível que a tela mostra — nunca negativo (D-53). Nulo = sem leitura. */
  em_estoque: number | null
  /** Quanto o disponível passou do zero: vendido sem estoque. */
  necessidade_extrema: number
  abaixo_minimo: boolean
  /** Quanto falta para voltar ao mínimo (0 quando está acima). */
  repor: number
  /** Prontos COM pedido no ESTOQUE (etiquetas SKU + pedido). */
  prontos_reservados: number
  /** Prontos SEM pedido no ESTOQUE (vieram da reposição). */
  prontos_livres: number
  reposicao_card_id: number | null
  reposicao_estado: EstadoReposicao | null
  reposicao_quantidade: number | null
  reposicao_liberadas: number | null
  contagem_total: number
}

const numeroOuNulo = (v: unknown) => (v === null || v === undefined ? null : Number(v))

export async function listarEstoqueProdutos(parametros: {
  grupo: GrupoEstoque
  busca?: string
  filtro?: FiltroEstoque | null
  limite?: number
  deslocamento?: number
}): Promise<LinhaEstoqueProduto[]> {
  const { data, error } = await supabase.rpc('plt_fn_estoque_produtos', {
    p_grupo: parametros.grupo,
    p_busca: parametros.busca || null,
    p_filtro: parametros.filtro ?? null,
    p_limite: parametros.limite ?? 20,
    p_deslocamento: parametros.deslocamento ?? 0,
  })
  // numeric chega como texto do PostgREST — vira número aqui, num lugar só.
  return garantir(
    data as LinhaEstoqueProduto[] | null,
    error,
    'Não deu para carregar o estoque',
  ).map((l) => ({
    ...l,
    minimo: numeroOuNulo(l.minimo),
    saldo_tiny: numeroOuNulo(l.saldo_tiny),
    reservas_loja: Number(l.reservas_loja ?? 0),
    em_estoque: numeroOuNulo(l.em_estoque),
    necessidade_extrema: Number(l.necessidade_extrema ?? 0),
    repor: Number(l.repor ?? 0),
    contagem_total: Number(l.contagem_total ?? 0),
  }))
}

/**
 * As PEÇAS paradas no ESTOQUE (SESSAO-15, evoluída na SESSAO-25): reservadas
 * (com pedido — as duas etiquetas, SKU + pedido) e livres (sem pedido — da
 * reposição). O ID é o SKU (resposta do dono na Q-63).
 */
export interface PecaEstoque {
  card_id: number
  dono: 'pedido' | 'livre'
  pedido_id: number | null
  numero: number | null
  item_codigo: string | null
  item_descricao: string | null
  indice_unidade: number | null
  total_unidades: number | null
  produto_tiny_id: number | null
  reposicao_card_id: number | null
  origem: 'pedido' | 'reposicao'
  qualidade_atual: Estado | null
  desde: string | null
  contagem_total: number
}

export async function listarPecasEstoque(parametros: {
  produtoTinyId?: number | null
  dono?: 'pedido' | 'livre' | null
  busca?: string
  limite?: number
  deslocamento?: number
}): Promise<PecaEstoque[]> {
  const { data, error } = await supabase.rpc('plt_fn_estoque', {
    p_busca: parametros.busca || null,
    p_limite: parametros.limite ?? 20,
    p_deslocamento: parametros.deslocamento ?? 0,
    p_produto_tiny_id: parametros.produtoTinyId ?? null,
    p_dono: parametros.dono ?? null,
  })
  return garantir(data as PecaEstoque[] | null, error, 'Não deu para carregar as peças do estoque')
}

/**
 * Sugestão de mínimo (SESSAO-25): os 20 mais vendidos dos últimos 90 dias, com
 * rank — média semanal × semanas de cobertura escolhidas na tela. O dono ajusta
 * o mínimo no Tiny (o mínimo mora lá).
 */
export interface LinhaSugestaoMinimo {
  posicao: number
  tiny_id: number
  codigo: string
  descricao: string
  vendidos_90d: number
  media_semana: number
  minimo_atual: number | null
  sugestao: number
  em_estoque: number | null
}

export async function sugestaoMinimo(semanas: number): Promise<LinhaSugestaoMinimo[]> {
  const { data, error } = await supabase.rpc('plt_fn_estoque_sugestao_minimo', {
    p_semanas: semanas,
  })
  return garantir(
    data as LinhaSugestaoMinimo[] | null,
    error,
    'Não deu para carregar a sugestão de mínimo',
  ).map((l) => ({
    ...l,
    vendidos_90d: Number(l.vendidos_90d ?? 0),
    media_semana: Number(l.media_semana ?? 0),
    minimo_atual: numeroOuNulo(l.minimo_atual),
    em_estoque: numeroOuNulo(l.em_estoque),
  }))
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
  /** SESSAO-22 (D-48): quando a PRIMEIRA unidade ficou pronta (chegou em terminal). */
  primeira_pronta_em: string | null
  /** SESSAO-22 (D-48): quando o pedido ficou COMPLETO — é daqui que o tempo de
   *  aguardo total conta (insumo futuro do cálculo de tempo de entrega). */
  completo_em: string | null
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
  /** Nulo na peça da REPOSIÇÃO de estoque (SESSAO-25). */
  pedido_id: number | null
  numero: number | null
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
