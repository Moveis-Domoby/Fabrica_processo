import type { Estado } from '@/componentes/ui'

/** Setor como vive em plt_setores (D-12/D-13). */
export interface Setor {
  id: number
  codigo: string
  nome: string
  papel_no_fluxo: 'entrada' | 'producao' | 'terminal'
  ordem: number
  ativo: boolean
  /** D-24: máximo de cards em execução pela MESMA pessoa aqui. null = sem limite. */
  limite_execucoes_por_pessoa: number | null
}

/** Etapa interna de um setor (D-14): cadastro livre, toda etapa conta tempo. */
export interface Etapa {
  id: number
  setor_id: number
  nome: string
  ordem: number
  eh_fila: boolean
  ativa: boolean
}

/** Card do kanban (D-01): 'pedido' é o que o PCP enxerga; 'unidade' é o (k/n). */
export interface Card {
  id: number
  tipo: 'pedido' | 'unidade'
  pedido_id: number
  card_pai_id: number | null
  item_seq: number | null
  item_codigo: string | null
  item_descricao: string | null
  indice_unidade: number | null
  total_unidades: number | null
  setor_atual_id: number | null
  etapa_atual_id: number | null
  desde: string | null
  /** Quem está executando AGORA (projeção de evento — SESSAO-05). */
  executor_atual_id: string | null
  qualidade_atual: Estado | null
  concluido_em: string | null
}

/** Colunas de plt_cards que o front lê — espelho do tipo Card acima. */
export const COLUNAS_CARD =
  'id, tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao, ' +
  'indice_unidade, total_unidades, setor_atual_id, etapa_atual_id, desde, ' +
  'executor_atual_id, qualidade_atual, concluido_em'

/** Linha de plt_fn_pedidos_kanban — resumo sem dado pessoal do cliente. */
export interface PedidoResumo {
  pedido_id: number
  numero: number
  cliente_nome: string
  data_pedido: string | null
  data_prevista: string | null
  situacao: string | null
  total_itens: number
  total_unidades: number
  tem_card: boolean
  unidades_liberadas: number
  contagem_total: number
}

/** Linha de plt_fn_pedido_itens_kanban — item já traduzido em unidades (k/n). */
export interface ItemKanban {
  seq: number
  codigo: string | null
  descricao: string | null
  unidades: number
}

/** Linha de plt_fn_expedicao_kanban — o reagrupamento do pedido (D-01/D-13). */
export interface ExpedicaoLinha {
  pedido_id: number
  numero: number
  cliente_nome: string
  data_prevista: string | null
  total_unidades: number
  unidades_liberadas: number
  unidades_no_terminal: number
  contagem_total: number
}

/** Linha de plt_fn_pedido_unidades — onde está cada unidade de um pedido. */
export interface UnidadePedido {
  card_id: number
  item_seq: number | null
  item_codigo: string | null
  item_descricao: string | null
  indice_unidade: number | null
  total_unidades: number | null
  setor_id: number | null
  setor_nome: string | null
  setor_terminal: boolean
  etapa_nome: string | null
  desde: string | null
  concluido_em: string | null
  qualidade_atual: Estado | null
}

/** Uma unidade a liberar no modal do PCP (ainda não existe como card). */
export interface UnidadeParaLiberar {
  item_seq: number
  item_codigo: string | null
  item_descricao: string | null
  indice_unidade: number
  total_unidades: number
}

/** Execução em andamento, como sai de plt_vw_execucoes (SESSAO-05/D-02). */
export interface ExecucaoAberta {
  evento_inicio_id: number
  card_id: number
  usuario_inicio_id: string
  iniciou_em: string
}

/** Uma linha de plt_fn_linha_tempo_card — evento enriquecido com nomes. */
export interface EventoLinhaTempo {
  evento_id: number
  tipo:
    | 'card_criado'
    | 'movimentacao_setor'
    | 'movimentacao_etapa'
    | 'execucao_iniciada'
    | 'execucao_finalizada'
    | 'qualidade_marcada'
    | 'qualidade_parecer'
    | 'divergencia_registrada'
    | 'notificacao_enviada'
    | 'delegacao'
    | 'estorno'
  ocorrido_em: string
  usuario_id: string | null
  usuario_nome: string | null
  setor_origem_id: number | null
  setor_origem_nome: string | null
  etapa_origem_nome: string | null
  setor_destino_id: number | null
  setor_destino_nome: string | null
  etapa_destino_nome: string | null
  etapa_destino_eh_fila: boolean
  estado_qualidade: Estado | null
  observacao: string | null
  origem: 'interface' | 'api' | 'automacao'
  evento_referencia_id: number | null
  estornado: boolean
  dados: Record<string, unknown>
}
