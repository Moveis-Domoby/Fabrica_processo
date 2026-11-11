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
  /** D-34: como o card que chega ganha dono — desativada · direta · aleatoria. */
  modo_delegacao: 'desativada' | 'direta' | 'aleatoria'
  /**
   * SESSAO-31 (D-126): em que tipos de card quem TIRA a peça deste setor marca
   * o estado (perfeito/atenção/danificado). Vazio = não pede — o padrão.
   */
  qualidade_envio_tipos: TipoQualidade[]
  /** SESSAO-31 (D-126): em que tipos de card o setor CONFIRMA o estado na chegada. */
  qualidade_recebimento_tipos: TipoQualidade[]
}

/** SESSAO-31 (D-126): os tipos de card das chaves de estado da peça. */
export type TipoQualidade = 'peca_pedido' | 'peca_estoque' | 'avulso'

/** Etapa interna de um setor (D-14): cadastro livre, toda etapa conta tempo. */
export interface Etapa {
  id: number
  setor_id: number
  nome: string
  ordem: number
  eh_fila: boolean
  /** D-09/D-25: etapa especial para onde vai o 🔴 confirmado — o sistema garante uma por setor. */
  eh_danificado: boolean
  ativa: boolean
  /**
   * SESSAO-24: etapa que ENCAMINHA — soltar o card aqui o leva para este setor
   * (a etapa com nome de setor e o CONCLUÍDO, como no ClickUp). Nulo = comum.
   */
  setor_destino_id: number | null
  /**
   * SESSAO-31 (D-127): soltar a peça aqui CONCLUI a produção (a EXPEDIÇÃO da
   * LIMPEZA E EMBALAGEM) — Pedidos em aguardo ou ESTOQUE, o banco decide.
   */
  conclui_producao: boolean
  /**
   * SESSAO-31 (§4): soltar aqui um card em EXECUÇÃO pede o motivo da parada
   * (o PARADO). O tempo fecha como antes; o motivo fica na frente do card.
   */
  pede_motivo: boolean
  /**
   * SESSAO-48: soltar a PEÇA aqui cancela a fabricação dela — ela sai da
   * produção na hora (o CANCELADO e o NÃO ENCONTRADO da LIMPEZA E EMBALAGEM).
   * Ausente (o quadro só manda quando cancela) = não cancela.
   */
  cancela_fabricacao?: boolean
  /** SESSAO-48: o motivo que a peça leva ao chegar aqui. */
  cancela_motivo?: MotivoCancelamento | null
  /** SESSAO-48: quantos dias a peça cancelada fica à vista na coluna (padrão 7). */
  cancela_dias?: number
}

/** SESSAO-48: por que a peça saiu da produção (o motivo da coluna onde chegou). */
export type MotivoCancelamento = 'cancelada' | 'nao_encontrada'

/**
 * Card do kanban (D-01): 'pedido' é o que o PCP enxerga; 'unidade' é o (k/n).
 * SESSAO-25: 'reposicao' é o card que o ESTOQUE gera no PCP quando um produto
 * fica abaixo do mínimo — sem pedido do Tiny; as unidades dele também nascem
 * sem pedido e, prontas, ficam livres no estoque.
 * SESSAO-31 (D-125): 'avulso' é o card digitado à mão no PCP (Lançamento
 * manual) — anda pelos quadros como a peça, mas nunca vira peça.
 */
export interface Card {
  id: number
  tipo: 'pedido' | 'unidade' | 'reposicao' | 'avulso'
  /** Nulo só na REPOSIÇÃO de estoque e nas unidades dela (SESSAO-25). */
  pedido_id: number | null
  /**
   * Só na porta do quadro do PCP (migration 48 — D-62): quantas peças do
   * galpão atendem o pedido (reservadas p/ ele + livres de mesmo SKU).
   */
  pecas_estoque?: number
  /** SESSAO-25: produto do catálogo da fábrica (reposição e unidades dela). */
  produto_tiny_id: number | null
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
  /** D-34: a quem o afazer foi delegado (projeção do evento de delegação). */
  responsavel_id: string | null
  /** SESSAO-23: quando a delegação atual aconteceu — a ordem de cadastro na Fila de prioridade. */
  delegado_em: string | null
  qualidade_atual: Estado | null
  concluido_em: string | null
  /** SESSAO-22 (D-48): quando a execução aberta foi pausada pelo líder. null = não pausado. */
  pausado_em: string | null
  /** SESSAO-22 (D-48): quando a ÚLTIMA unidade foi liberada (só card de pedido) — fim do tempo em PCP. */
  liberado_completo_em: string | null
  /**
   * SESSAO-27 (D-101): as etiquetas do card (ids — projeção dos eventos de
   * etiqueta). Ausente na porta do quadro do PCP, que busca à parte.
   */
  etiquetas?: number[]
  /**
   * SESSAO-32 (dívida 15): o resumo do pedido, quando a porta já traz junto
   * (o quadro do PCP — plt_fn_pcp_quadro) — nada de segunda leitura em fila.
   */
  pedido_resumo?: PedidoResumo | null
  /**
   * SESSAO-31 (D-126): a chegada que o setor ainda precisa confirmar (a
   * marcação de quem entregou ou a própria chegada). Nula = nada a confirmar.
   * Projeção do banco — a tela não pergunta mais à parte.
   */
  parecer_pendente_id?: number | null
  // ---- SESSAO-31 (D-125): as propriedades do card (projeções — vêm do quadro e da janela)
  /** O nome do card avulso. */
  titulo?: string | null
  descricao?: string | null
  inicio_em?: string | null
  vence_em?: string | null
  /** Os responsáveis (vários) — diferente de responsavel_id (a delegação do afazer). */
  responsaveis?: string[]
  anexos_qtd?: number
  mensagens_qtd?: number
  /** O vínculo do avulso (só referência — D-125). */
  vinculo_tipo?: 'pedido' | 'produto' | 'peca' | null
  vinculo_id?: number | null
  vinculo_rotulo?: string | null
  /** D-130: a peça em AJUSTE e o destino final escolhido pelo PCP. */
  ajuste_destino?: 'estoque' | 'pedido' | 'terceirizado' | 'loja' | 'danificados' | null
  criado_por_id?: string | null
  /**
   * SESSAO-31 (§4): o motivo da pausa (execução pausada) ou da parada (solto
   * na etapa que pede o motivo) — projeção do banco; some ao retomar.
   */
  pausa_motivo?: string | null
  /** SESSAO-36 (D-146): quem está no card como AUXILIAR agora (projeção). */
  auxiliares?: string[]
  /**
   * SESSAO-38 (D-150): a prioridade do card ('urgente' | 'atencao' | nulo =
   * comum). Na peça é a do PEDIDO (herdada — `prioridade_herdada`).
   */
  prioridade?: 'urgente' | 'atencao' | null
  prioridade_herdada?: boolean
  /** SESSAO-38 (D-150): a data de entrega — a do pedido no Tiny (ao vivo); no avulso, o vencimento. */
  data_entrega?: string | null
  /**
   * SESSAO-48: a fabricação desta peça foi cancelada (ela chegou numa coluna
   * que cancela) — desde quando, o motivo e o pedido que ela perdeu. Ausente =
   * peça em produção. Projeção do banco (o quadro só manda quando há).
   */
  cancelada_em?: string | null
  cancelada_motivo?: MotivoCancelamento | null
  cancelada_pedido_numero?: number | null
  /**
   * SESSAO-48 (frente 3): a peça é de um pedido cancelado no Tiny e espera a
   * logística decidir para onde vai. Ausente = nada a decidir.
   */
  destino_pendente_em?: string | null
}

/**
 * O que o card mostra do pedido dele (o quadro numa requisição traz só isto —
 * SESSAO-31). O resumo completo do pedido cabe aqui também.
 */
export type PedidoDoCard = Pick<
  PedidoResumo,
  'pedido_id' | 'numero' | 'situacao' | 'data_prevista' | 'entrou_pcp_em' | 'liberado_completo_em'
> & {
  /**
   * ↩️ SESSAO-38 (item 3 do dono, D-28): o quadro do setor NÃO manda mais o
   * nome do cliente (o card do setor não mostra); quem ainda traz é o PCP.
   */
  cliente_nome?: string
  data_pedido?: string | null
} & StandbyDoPedido

/**
 * SESSAO-38 (D-169): o stand-by do pedido no PCP — o aberto (desde quando, o
 * motivo, quem pôs) e os períodos já fechados. O relógio do PCP desconta todos.
 */
export interface StandbyDoPedido {
  standby_desde?: string | null
  standby_motivo?: string | null
  standby_por?: string | null
  standby_periodos?: { ini: string; fim: string }[] | null
}

/**
 * SESSAO-47: o pedido que o Tiny tinha levado adiante (Faturado, Pronto para
 * envio, Enviado) e que a logística devolveu ao PCP pedindo ao Tiny a situação
 * de antes. Enquanto o Tiny não mostra outra situação, o pedido fica no PCP com
 * esta marca — a tela diz se o Tiny ainda não confirmou.
 */
export interface VoltaPcp {
  desde: string
  /** O que foi pedido ao Tiny (os nomes que a API dele usa). */
  situacao_pedida: 'aberto' | 'preparando_envio'
  /** O que o Tiny mostra agora. */
  situacao_tiny: string | null
  /**
   * A fila de saída: esperando a resposta · falhando (tentando de novo) ·
   * parado (o Tiny recusou, os administradores foram avisados) · aceito (o Tiny
   * aceitou; falta só a situação nova chegar).
   */
  estado: 'esperando' | 'falhando' | 'parado' | 'aceito'
}

/** Colunas de plt_cards que o front lê — espelho do tipo Card acima. */
export const COLUNAS_CARD =
  'id, tipo, pedido_id, card_pai_id, item_seq, item_codigo, item_descricao, ' +
  'indice_unidade, total_unidades, setor_atual_id, etapa_atual_id, desde, ' +
  'executor_atual_id, responsavel_id, delegado_em, qualidade_atual, concluido_em, ' +
  'pausado_em, liberado_completo_em, produto_tiny_id, etiquetas, parecer_pendente_id'

/**
 * Uma página de cards de uma coluna do quadro (SESSAO-22): a regra "cada tela
 * requisita só o que mostra" — 10 por vez, com o total real vindo do servidor.
 */
export interface PaginaDeCards {
  cards: Card[]
  total: number
}

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
  /** SESSAO-09: o Tiny mudou o pedido DEPOIS de unidades irem à produção. */
  alterado_apos_liberacao: boolean
  /** SESSAO-22 (D-48): quando o pedido entrou no PCP — o começo do tempo em PCP. */
  entrou_pcp_em: string | null
  /** SESSAO-22 (D-48): quando a última unidade foi liberada — o fim do tempo em PCP. */
  liberado_completo_em: string | null
  contagem_total: number
  /** SESSAO-38 (D-169): o stand-by do pedido — vem no resumo do quadro do PCP. */
  standby_desde?: string | null
  standby_motivo?: string | null
  standby_por?: string | null
  standby_periodos?: { ini: string; fim: string }[] | null
  /**
   * SESSAO-45: quantas das peças do estoque que atendem o pedido já estão
   * RESERVADAS para ele (o resto, de `pecas_estoque`, está livre).
   */
  pecas_reservadas?: number
  /** SESSAO-47: a logística devolveu este pedido ao PCP e o Tiny ainda não mostrou a situação nova. */
  volta_pcp?: VoltaPcp | null
  /**
   * SESSAO-48 (frente 2): peça deste pedido cancelada na produção — a vaga
   * voltou ao PCP. O selo do quadro do PCP e a janela "O que aconteceu?".
   * Ausente = sem aviso.
   */
  aviso_cancelada?: AvisoCancelada | null
}

/** SESSAO-48: o aviso da peça cancelada na produção, no card do pedido (PCP). */
export interface AvisoCancelada {
  /** Desde quando o aviso está aberto (a 1ª peça cancelada que o PCP ainda não viu). */
  desde: string
  /** Quantas peças do pedido foram canceladas desde então. */
  pecas: number
  /** 'nao_encontrada' só quando TODAS são "não encontrada". */
  motivo: MotivoCancelamento
}

/**
 * SESSAO-30 (D-117): onde o pedido está NA PLATAFORMA (a situação do Tiny é
 * outra coisa — vem em `situacao`).
 */
export type SituacaoPlataforma =
  | 'sem_card'
  | 'pcp'
  | 'producao'
  | 'aguardo'
  | 'em_rota'
  | 'entregue'
  | 'arquivado'
  /** SESSAO-31 (D-129): as peças voltaram e esperam a decisão da logística. */
  | 'devolvido'
  /** 14/10 (D-132): o Tiny levou o pedido adiante (faturado…) sem nada liberado. */
  | 'tiny'
  /** 14/10 (D-134): cancelado no Tiny. */
  | 'cancelado'
  /** SESSAO-48 (frente 2): o PCP tirou o pedido da linha de produção (aba "Cancelados e removidos"). */
  | 'removido_pcp'

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
  /** Situação do Tiny — 'cancelado' vira selo (SESSAO-09/D-31). */
  situacao: string | null
  total_unidades: number
  unidades_liberadas: number
  unidades_no_terminal: number
  /** SESSAO-09: o Tiny mudou o pedido DEPOIS de unidades irem à produção. */
  alterado_apos_liberacao: boolean
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
/**
 * Marcação de qualidade sem parecer, como sai de plt_vw_qualidade_transicoes
 * (SESSAO-06/D-09) — o que o setor recebedor ainda precisa responder.
 */
/**
 * SESSAO-31 (D-126): a chegada que o setor confirma — lida só ao abrir a
 * confirmação (o card já diz que há pendência). `tipo` 'qualidade_marcada' =
 * quem entregou marcou; 'movimentacao_setor' = ninguém marcou na saída.
 */
export interface ChegadaPendente {
  id: number
  tipo: 'qualidade_marcada' | 'movimentacao_setor'
  setor_origem_id: number | null
  usuario_id: string | null
  estado_qualidade: Extract<Estado, 'perfeito' | 'atencao' | 'danificado'> | null
}

/** A pendência já enriquecida com nomes — o que o card e o modal mostram. */
export interface ParecerPendente {
  /** A chegada que a confirmação responde (marcação ou a própria chegada). */
  marcacaoEventoId: number
  /** O estado que quem entregou marcou — nulo quando ninguém marcou na saída. */
  estado: Extract<Estado, 'perfeito' | 'atencao' | 'danificado'> | null
  setorOrigemNome: string
  remetenteNome: string | null
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
    | 'execucao_pausada'
    | 'execucao_retomada'
    | 'qualidade_marcada'
    | 'qualidade_parecer'
    | 'divergencia_registrada'
    | 'notificacao_enviada'
    | 'delegacao'
    | 'estorno'
    | 'pedido_atualizado'
    | 'pedido_cancelado'
    | 'card_arquivado'
    | 'pedido_entregue'
    | 'pedido_lancado_rotas'
    // SESSAO-24: a peça que perdeu o pedido (cancelado) e a peça livre usada por um pedido.
    | 'unidade_desvinculada'
    | 'peca_alocada'
    // D-201: a peça sem dono em produção passou a ser de um pedido.
    | 'peca_vinculada'
    // SESSAO-27 (D-101/D-102): etiquetas e o "trazer de volta".
    | 'etiqueta_adicionada'
    | 'etiqueta_removida'
    | 'card_desarquivado'
    // SESSAO-30/31: entrega, devolução, ajuste e as propriedades do card.
    | 'entrega_desfeita'
    | 'entrega_nao_realizada'
    | 'pedido_devolvido'
    | 'devolucao_decidida'
    | 'ajuste_aberto'
    | 'ajuste_concluido'
    | 'avulso_concluido'
    | 'card_editado'
    | 'responsavel_adicionado'
    | 'responsavel_removido'
    | 'anexo_adicionado'
    | 'anexo_removido'
    // SESSAO-38 (D-150/D-152): a prioridade e o responsável de um setor.
    | 'prioridade_definida'
    | 'responsavel_setor_definido'
    // SESSAO-38 (D-169): o stand-by do pedido no PCP.
    | 'pedido_standby_entrou'
    | 'pedido_standby_saiu'
    // SESSAO-36 (D-146): o auxílio (vem na história do card).
    | 'auxilio_iniciado'
    | 'auxilio_pausado'
    | 'auxilio_retomado'
    | 'auxilio_encerrado'
    // SESSAO-42 (regra 14): a decisão manual sobre o tempo de uma passagem.
    | 'tempo_decisao'
    // SESSAO-47: a volta ao PCP do pedido que o Tiny levou adiante, e o fim dela.
    | 'pedido_volta_pcp'
    | 'pedido_volta_pcp_fim'
    // SESSAO-48: cancelar e retomar a fabricação; o aviso, a remoção e a devolução
    // no PCP; o destino da peça de pedido cancelado no Tiny.
    | 'fabricacao_cancelada'
    | 'fabricacao_retomada'
    | 'pcp_aviso_resolvido'
    | 'pedido_removido_pcp'
    | 'pedido_devolvido_pcp'
    | 'destino_pendente'
    | 'destino_decidido'
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

/**
 * SESSAO-42 (F4): a situação da passagem no cálculo único — aberta (o card
 * ainda está no setor), válida (entra na média) ou fora da média (conferir,
 * retrabalho, gesto de administrador, sem registro, antes da data oficial,
 * descartada à mão).
 */
export type SituacaoPassagem =
  | 'aberta'
  | 'valida'
  | 'conferir'
  | 'retrabalho'
  | 'admin'
  | 'sem_registro'
  | 'teste'
  | 'descartada'

/**
 * SESSAO-42 (F4): a estadia do card num setor de produção, como o banco
 * calculou (plt_fn_card_historico). `id` é o fato da entrada no setor. Os
 * tempos em segundos, já pela régua (só o que conta).
 */
export interface PassagemDoCard {
  id: number
  setor_id: number
  entrada_em: string
  saida_em: string | null
  fila_s: number
  /** o TEMPO DO MÓVEL: a união dos trechos, com a divisão do trabalho simultâneo */
  execucao_s: number
  /** o mesmo, só dos trechos que já fecharam (o aberto o aparelho soma) */
  execucao_fechada_s: number
  parado_s: number
  total_s: number
  esforco_s: number
  situacao: SituacaoPassagem
  motivo: string | null
  desfecho: 'aberta' | 'concluida' | 'retrabalho' | 'saiu'
  lote: boolean
  modelo: string | null
}

/**
 * SESSAO-42 (F3/F4): um trecho — o período contínuo em que uma pessoa ficou
 * com o card rodando (execução ou ajuda). `id` é o fato que abriu o trecho
 * (o iniciar, a retomada ou o início da ajuda).
 */
export interface TrechoDoCard {
  id: number
  passagem_id: number
  usuario_id: string
  papel: 'execucao' | 'auxilio'
  inicio: string
  fim: string | null
  fim_tipo:
    | 'pausa'
    | 'fim_expediente'
    | 'sem_resposta'
    | 'esquecido'
    | 'movimento'
    | 'volta'
    | 'setor'
    | 'transferencia'
    | 'finalizado'
    | 'arquivado'
    | null
  /** o fim do expediente do dia em que começou; nulo = o setor não corta */
  corte: string | null
  /** os segundos que contam, depois da divisão (o esforço da pessoa) */
  segundos: number
  util_s: number
  /** o clique errado (volta rápida para a fila) — não conta */
  descartado: boolean
}

/** SESSAO-42 (F4): "Tempo e histórico" numa requisição — os fatos + os números do banco. */
export interface HistoricoDoCardDados {
  eventos: EventoLinhaTempo[]
  passagens: PassagemDoCard[]
  trechos: TrechoDoCard[]
}
