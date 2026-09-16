export interface ItemPurchase {
  nome?: string;
  item?: string; // Algumas APIs retornam "item"
  quantidade?: number;
  valor_unitario?: number;
  [key: string]: any;
}

export interface SaleRecord {
  id: string;
  numero_pedido: string;
  nome_cliente: string;
  telefone_cliente: string;
  instagram_cliente: string;
  data_compra: string;
  valor_pedido: number;
  numero_itens: number;
  itens_comprados: ItemPurchase[];
}

export interface GroupedCustomer {
  telefone: string;
  nome: string;
  instagram: string;
  // Período filtrado
  quantidade_pedidos: number;
  total_itens: number;
  faturamento_total: number;
  ultima_compra: Date;
  itens_consolidados: ItemPurchase[];
  // Vida completa (sem filtro temporal)
  pedidos_vida: number;
  data_primeira_compra: Date;
  is_recorrente: boolean;
}

export type DateFilterType = 'all' | 'custom' | 'specificYear' | 'specificMonth' | 'specificDay';
export type PurchaseCountFilterType = 'all' | '1' | '2' | '3' | '4+';

export interface FilterState {
  dateFilter: DateFilterType;
  customDateStart: string;
  customDateEnd: string;
  selectedItems: string[];
  purchaseCount: string[];
  specificMonth: string;
  // "Do dia": YYYY-MM-DD
  specificDay: string;
  // "Do ano": YYYY
  specificYear: string;
  searchQuery: string;
  inactiveBeforeDate: string;
  // --- Novos Filtros ---
  recompraMinDays: string;
  recompraMaxDays: string;
  spendAmount: string;
  spendType: 'total' | 'average';
  spendMode: 'above' | 'below' | 'around';
}

// --- Tipos de Listas de Disparo ---

export type StatusListaDisparo = 'rascunho' | 'sincronizada' | 'disparando' | 'em_andamento' | 'encerrada';

export interface ListaDisparo {
  id: string;
  nome: string;
  status: StatusListaDisparo;
  taxa_resposta: number;
  ganhos: number;
  receita_gerada: number;
  total_membros: number;
  id_lista_crm: string | null;
  janela_resposta_dias: number;
  janela_resultado_dias: number;
  intervalo_disparo_segundos: number | null;
  ultimo_envio_em: string | null;
  mensagem_utilizada: string | null;
  custo_disparo: number;
  criada_em: string;
}

export type StatusMembroDisparo = 'aguardando_envio' | 'aguardando_resposta' | 'respondido_aguardando_resultado' | 'ganho' | 'perdido';
export type MotivoPerdaMembro = 'sem_resposta_no_prazo' | 'prazo_resultado_expirado' | 'negocio_perdido_crm' | 'erro_envio_mensagem' | 'lista_encerrada_manualmente';

export interface ListaDisparoMembro {
  id: string;
  lista_id: string;
  nome_cliente: string;
  telefone: string;
  status: StatusMembroDisparo;
  motivo_perda: MotivoPerdaMembro | null;
  data_envio: string | null;
  prazo_resposta_limite: string | null;
  data_resposta: string | null;
  prazo_resultado_limite: string | null;
  data_resultado: string | null;
  valor_ganho: number | null;
  id_negocio_crm: string | null;
  snapshot_total_gasto: number;
  snapshot_qtd_compras: number;
  snapshot_ultima_compra: string;
}

export interface ListaDisparoEvento {
  id: string;
  lista_id: string;
  membro_id: string | null;
  tipo_evento: string;
  descricao: string;
  criado_em: string;
}

export interface ScorecardsLista {
  lista_id: string;
  total_membros: number;
  total_enviados: number;
  taxa_resposta_pct: number;
  taxa_conversao_pct: number;
  receita_gerada: number;
  ticket_medio: number;
  roi_pct: number | null;
  perdas_sem_resposta: number;
  perdas_prazo_expirado: number;
  perdas_crm: number;
  total_erros_envio: number;
  tarifa_aplicada: number | null;
  custo_total_real: number;
}
