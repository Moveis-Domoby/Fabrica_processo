import { supabase } from '@/lib/supabase'
import type { SituacaoPlataforma } from '@/kanban/tipos'

/**
 * A área PEDIDOS (ajustes do dono, 14/10 noite — D-134): "Todos os pedidos" e
 * "Cancelados", com tudo de cada pedido revelado aos poucos, por clique. Cada
 * porta traz só o que o gesto mostra (Lei §3): a lista por cursor; a ficha
 * (janela completa do pedido) no clique na linha; a produção e os dados do
 * Tiny no clique dos botões deles.
 */

export const PEDIDOS_POR_PAGINA = 20

export interface PedidoDaLista {
  pedido_id: number
  numero: number
  cliente_nome: string
  data_pedido: string | null
  data_prevista: string | null
  /** A situação no Tiny, como ele manda ("Preparando envio", "Entregue"…). */
  situacao: string | null
  total_pedido: number | null
  /** Quem fechou a venda (o vendedor do Tiny). */
  vendedor: string | null
  marcadores: string[]
  total_unidades: number
  unidades_liberadas: number
  unidades_prontas: number
  card_id: number | null
  situacao_plataforma: SituacaoPlataforma
  entregue_em: string | null
  entregue_por: string | null
  entregue_fonte: 'tiny' | 'plataforma' | string | null
  /** A data de entrega que o Tiny guarda (dd/mm/aaaa), quando a plataforma não registrou. */
  entregue_tiny: string | null
  cancelado_em: string | null
  tem_mais: boolean
  /** Só na primeira página (até 10.001). */
  contagem_total: number | null
  /** SESSAO-38: o pedido programado ("Em rota") — o dia, o caminhão e a rota. */
  programacao_data?: string | null
  caminhao_nome?: string | null
  rota?: number | null
}

export async function listarPedidos(parametros: {
  busca?: string
  antesNumero?: number | null
  limite?: number
  cancelados?: boolean
}): Promise<PedidoDaLista[]> {
  const { data, error } = await supabase.rpc('plt_fn_pedidos_lista', {
    p_busca: parametros.busca?.trim() || null,
    p_antes_numero: parametros.antesNumero ?? null,
    p_limite: parametros.limite ?? PEDIDOS_POR_PAGINA,
    p_cancelados: parametros.cancelados ?? false,
  })
  if (error) throw new Error(`Não deu para carregar os pedidos: ${error.message}`)
  return (data ?? []) as PedidoDaLista[]
}

export interface ExecucaoDaPeca {
  setor: string | null
  etapa: string | null
  pessoa: string | null
  /** SESSAO-36 (D-146): a foto de quem trabalhou. */
  foto?: string | null
  iniciou_em: string
  finalizou_em: string | null
  em_andamento: boolean
  /** Tempo de trabalho, com as pausas descontadas. */
  segundos: number
  pausa_segundos: number
}

export interface PecaDoPedido {
  card_id: number
  item_seq: number | null
  codigo: string | null
  descricao: string | null
  indice: number | null
  total: number | null
  setor: string | null
  etapa: string | null
  no_fim_de_linha: boolean
  desde: string | null
  concluido_em: string | null
  arquivado_em: string | null
  /** Como a peça saiu das contas (entregue, venda, pedido arquivado…). */
  motivo_saida: string | null
  qualidade: string | null
  /** A peça ficou sem o pedido (cancelamento) — está no estoque, sem dono. */
  perdeu_pedido: boolean
  segundos: number
  execucoes: ExecucaoDaPeca[]
}

export interface ProducaoDoPedido {
  pecas: PecaDoPedido[]
  pessoas: { nome: string; foto?: string | null; segundos: number; execucoes: number }[]
  segundos: number
}

/** A produção do pedido — no clique em "Produção". */
export async function producaoDoPedido(pedidoId: number): Promise<ProducaoDoPedido> {
  const { data, error } = await supabase.rpc('plt_fn_pedido_producao', { p_pedido_id: pedidoId })
  if (error) throw new Error(`Não deu para carregar a produção: ${error.message}`)
  return data as ProducaoDoPedido
}

export interface DadosDoTiny {
  pedido: Record<string, unknown> | null
  atualizado_em: string | null
  cliente: Record<string, unknown> | null
  notas_fiscais: Record<string, unknown>[]
  contas_receber: Record<string, unknown>[]
}

/** Tudo o que o Tiny mandou do pedido — no clique em "Dados do Tiny". */
export async function dadosDoTiny(pedidoId: number): Promise<DadosDoTiny> {
  const { data, error } = await supabase.rpc('plt_fn_pedido_tiny', { p_pedido_id: pedidoId })
  if (error) throw new Error(`Não deu para carregar os dados do Tiny: ${error.message}`)
  return data as DadosDoTiny
}
