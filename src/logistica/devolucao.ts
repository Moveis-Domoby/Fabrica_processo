import { supabase } from '@/lib/supabase'

/**
 * SESSAO-31 (D-129/D-130): a devolução decidida pela LOGÍSTICA. O "Pedido
 * devolvido" (marcarDevolvido, em rotas/api) deixa as peças em "Em decisão pós
 * devolução"; aqui ficam a lista das devoluções em decisão, a telinha
 * "Decidir situação" (uma requisição, só no clique) e as decisões. O ajuste de
 * peça (D-130) leva a MESMA peça de volta à produção com o destino final.
 * Todas as portas têm o gate da logística dentro do banco.
 */

function garantir<T>(dados: T | null, erro: { message: string } | null, contexto: string): T {
  if (erro) throw new Error(`${contexto}: ${erro.message}`)
  if (dados === null) throw new Error(`${contexto}: o servidor não devolveu dados.`)
  return dados
}

/** Uma devolução em decisão (a lista do Estoque — por cursor). */
export interface DevolucaoAberta {
  card_id: number
  pedido_id: number
  numero: number
  cliente_nome: string
  evento_id: number
  quando: string
  quem: string | null
  motivo: string | null
  entregue: boolean
  pecas: number
  tem_mais: boolean
}

export async function listarDevolucoes(parametros: {
  produtoTinyId?: number | null
  antesId?: number | null
  limite?: number
}): Promise<DevolucaoAberta[]> {
  const { data, error } = await supabase.rpc('plt_fn_devolucoes', {
    p_produto_tiny_id: parametros.produtoTinyId ?? null,
    p_antes_id: parametros.antesId ?? null,
    p_limite: parametros.limite ?? 20,
  })
  return garantir(
    data as DevolucaoAberta[] | null,
    error,
    'Não deu para carregar as devoluções',
  ).map((d) => ({ ...d, card_id: Number(d.card_id), evento_id: Number(d.evento_id) }))
}

export type DecisaoDevolucao =
  'reenviar' | 'estoque' | 'realocar' | 'danificados' | 'loja' | 'ajuste'
export type DestinoFinalAjuste = 'estoque' | 'pedido' | 'terceirizado' | 'loja' | 'danificados'

export interface PecaDevolvida {
  id: number
  descricao: string | null
  sku: string | null
  indice: number | null
  total: number | null
  qualidade: 'perfeito' | 'atencao' | 'danificado' | null
  danificada: boolean
  em_decisao: boolean
  onde: string
  produto_tiny_id: number | null
}

/** A telinha "Decidir situação": o mini relatório e as peças, numa requisição. */
export interface DetalheDevolucao {
  card_id: number
  pedido_id: number
  numero: number
  situacao_tiny: string | null
  cancelado: boolean
  cliente: {
    nome: string | null
    telefone: string | null
    cidade: string | null
    bairro: string | null
  } | null
  em_decisao: boolean
  devolucao: {
    evento_id: number
    quando: string
    quem: string | null
    motivo: string | null
    observacao: string | null
    entregue: boolean
  } | null
  historico: { tipo: string; quando: string; quem: string | null; texto: string | null }[]
  comprovantes: number
  pecas: PecaDevolvida[]
  decididas: { peca_id: number; decisao: DecisaoDevolucao; quando: string; quem: string | null }[]
}

export async function detalheDevolucao(cardId: number): Promise<DetalheDevolucao> {
  const { data, error } = await supabase.rpc('plt_fn_devolucao_detalhe', { p_card_id: cardId })
  return garantir(data as DetalheDevolucao | null, error, 'Não deu para abrir a devolução')
}

export interface OpcaoRealocar {
  card_pedido_id: number
  numero: number
  cliente_nome: string
  data_prevista: string | null
  item_seq: number
  indice_unidade: number
}

/** Só no clique "Realocar": pedidos vivos no PCP com vaga da mesma peça. */
export async function opcoesRealocar(pecaId: number): Promise<OpcaoRealocar[]> {
  const { data, error } = await supabase.rpc('plt_fn_devolucao_realocar_opcoes', {
    p_peca_id: pecaId,
  })
  return garantir(data as OpcaoRealocar[] | null, error, 'Não deu para buscar os pedidos').map(
    (o) => ({
      ...o,
      card_pedido_id: Number(o.card_pedido_id),
    }),
  )
}

export interface ResultadoDecisao {
  decididas: number
  repetidas: number
  relancados: number[]
  reabertos: number[]
}

/**
 * A decisão (peça por peça ou várias): o banco aplica tudo numa transação. O
 * mesmo toque repetido em 10 minutos = um efeito só (Lei §10).
 */
export async function decidirDevolucao(parametros: {
  pecas: number[]
  decisao: DecisaoDevolucao
  destino?: Record<string, unknown>
  observacao?: string
}): Promise<ResultadoDecisao> {
  const { data, error } = await supabase.rpc('plt_fn_devolucao_decidir', {
    p_pecas: parametros.pecas,
    p_decisao: parametros.decisao,
    p_destino: parametros.destino ?? {},
    p_observacao: parametros.observacao?.trim() || null,
  })
  return garantir(data as ResultadoDecisao | null, error, 'Não deu para aplicar a decisão')
}

/** As palavras das decisões — a tela e o histórico falam igual. */
export const ROTULO_DECISAO: Record<DecisaoDevolucao, string> = {
  reenviar: 'Reenviar ao cliente',
  estoque: 'Devolver ao estoque',
  realocar: 'Realocar para outro pedido',
  danificados: 'Danificada → Danificados',
  loja: 'Liberar para o estoque da loja',
  ajuste: 'Mandar para ajuste',
}

export const ROTULO_DESTINO_FINAL: Record<DestinoFinalAjuste, string> = {
  estoque: 'Estoque da fábrica (peça livre)',
  pedido: 'Volta ao pedido (reentrega ao cliente)',
  terceirizado: 'Terceirizado',
  loja: 'Estoque da loja',
  danificados: 'Danificados',
}
