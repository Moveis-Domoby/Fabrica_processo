import { supabase } from '@/lib/supabase'
import type { Estado } from '@/componentes/ui'
import { COLUNAS_CARD } from './tipos'
import type {
  Card,
  Etapa,
  EventoLinhaTempo,
  ExecucaoAberta,
  ExpedicaoLinha,
  ItemKanban,
  PaginaDeCards,
  PedidoResumo,
  QualidadePendente,
  Setor,
  UnidadePedido,
  UnidadeParaLiberar,
} from './tipos'

/** SESSAO-22: 10 cards por página em cada coluna do quadro ("Ver mais" traz os próximos). */
export const CARDS_POR_PAGINA = 10

/**
 * Camada de dados do kanban (SESSAO-04).
 *
 * Duas portas, de propósito:
 * - tabelas plt_* direto (setores, etapas, cards, eventos) — o RLS da
 *   SESSAO-02 decide o que cada um enxerga e escreve;
 * - funções plt_fn_*_kanban (migration 13) para o que vem da integração do
 *   Tiny (pedidos/itens) e para o reagrupamento — nunca as tabelas da
 *   integração direto.
 *
 * MOVIMENTAR CARD = INSERIR EVENTO (M-02/M-13). A posição em plt_cards é
 * projeção mantida por trigger no banco; nenhuma função aqui faz UPDATE de
 * posição — se você está pensando em fazer, pare.
 */

function garantir<T>(dados: T | null, erro: { message: string } | null, contexto: string): T {
  if (erro) throw new Error(`${contexto}: ${erro.message}`)
  if (dados === null) throw new Error(`${contexto}: o servidor não devolveu dados.`)
  return dados
}

// ---------------------------------------------------------------------------
// Estrutura: setores e etapas
// ---------------------------------------------------------------------------

export async function buscarSetores(incluirInativos = false): Promise<Setor[]> {
  let consulta = supabase
    .from('plt_setores')
    .select('id, codigo, nome, papel_no_fluxo, ordem, ativo, limite_execucoes_por_pessoa, modo_delegacao')
    .order('ordem')
    .order('id')
  if (!incluirInativos) consulta = consulta.eq('ativo', true)
  const { data, error } = await consulta
  return garantir(data as Setor[] | null, error, 'Não deu para carregar os setores')
}

export async function buscarEtapasDoSetor(
  setorId: number,
  incluirInativas = false,
): Promise<Etapa[]> {
  let consulta = supabase
    .from('plt_etapas')
    .select('id, setor_id, nome, ordem, eh_fila, eh_danificado, ativa')
    .eq('setor_id', setorId)
    .order('ordem')
    .order('id')
  if (!incluirInativas) consulta = consulta.eq('ativa', true)
  const { data, error } = await consulta
  return garantir(data as Etapa[] | null, error, 'Não deu para carregar as etapas')
}

/** Todas as etapas ativas de todos os setores — para os seletores de destino. */
export async function buscarEtapasAtivas(): Promise<Etapa[]> {
  const { data, error } = await supabase
    .from('plt_etapas')
    .select('id, setor_id, nome, ordem, eh_fila, eh_danificado, ativa')
    .eq('ativa', true)
    .order('setor_id')
    .order('ordem')
  return garantir(data as Etapa[] | null, error, 'Não deu para carregar as etapas')
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export async function buscarCardsDoSetor(
  setorId: number,
  tipo?: 'pedido' | 'unidade',
): Promise<Card[]> {
  let consulta = supabase
    .from('plt_cards')
    .select(COLUNAS_CARD)
    .eq('setor_atual_id', setorId)
    // SESSAO-11: card arquivado (o "excluir" lógico da API) some das telas.
    .is('arquivado_em', null)
    .order('desde', { ascending: true, nullsFirst: false })
  if (tipo) consulta = consulta.eq('tipo', tipo)
  const { data, error } = await consulta
  return garantir(data as unknown as Card[] | null, error, 'Não deu para carregar os cards')
}

/**
 * UMA página de UMA coluna do quadro (SESSAO-22): a regra "cada tela requisita
 * só o que mostra" — o quadro nunca baixa o setor inteiro. A paginação e o
 * total (contagem exata, sem trazer linhas a mais) acontecem no servidor;
 * `etapaId` nulo lê os cards ainda sem etapa (a antiga "Chegada").
 */
export async function buscarCardsDaEtapa(parametros: {
  setorId: number
  etapaId: number | null
  tipo: 'pedido' | 'unidade'
  pagina: number
  porPagina?: number
}): Promise<PaginaDeCards> {
  const { setorId, etapaId, tipo, pagina } = parametros
  const porPagina = parametros.porPagina ?? CARDS_POR_PAGINA
  const inicio = pagina * porPagina
  let consulta = supabase
    .from('plt_cards')
    .select(COLUNAS_CARD, { count: 'exact' })
    .eq('setor_atual_id', setorId)
    .eq('tipo', tipo)
    .is('arquivado_em', null)
    .order('desde', { ascending: true, nullsFirst: false })
    .order('id')
    .range(inicio, inicio + porPagina - 1)
  consulta = etapaId === null ? consulta.is('etapa_atual_id', null) : consulta.eq('etapa_atual_id', etapaId)
  const { data, error, count } = await consulta
  if (error) throw new Error(`Não deu para carregar os cards: ${error.message}`)
  return { cards: (data as unknown as Card[]) ?? [], total: count ?? 0 }
}

/**
 * Os pedidos ABERTOS do quadro do PCP (SESSAO-22), paginados no servidor:
 * aberto = ainda tem unidade por liberar (`liberado_completo_em` nulo — a
 * projeção da D-48). SESSAO-23 (ajuste do dono): pedido ENCERRADO no Tiny
 * (entregue/não entregue) também sai do quadro — o filtro vive na porta
 * `plt_fn_cards_pedido_pcp` (a situação mora em `pedidos`, que o navegador
 * não lê; comparação sempre normalizada). Cancelado continua aparecendo.
 */
export async function buscarCardsPedidoPcp(parametros: {
  pagina: number
  porPagina?: number
}): Promise<PaginaDeCards> {
  const porPagina = parametros.porPagina ?? CARDS_POR_PAGINA
  const inicio = parametros.pagina * porPagina
  const { data, error } = await supabase.rpc('plt_fn_cards_pedido_pcp', {
    p_limite: porPagina,
    p_deslocamento: inicio,
  })
  if (error) throw new Error(`Não deu para carregar os pedidos do PCP: ${error.message}`)
  const linhas = (data ?? []) as (Card & { contagem_total: number })[]
  return { cards: linhas as unknown as Card[], total: linhas[0]?.contagem_total ?? 0 }
}

// ---------------------------------------------------------------------------
// Pedidos da integração (migration 13 — nunca as tabelas direto)
// ---------------------------------------------------------------------------

export interface FiltroPedidos {
  busca?: string
  somenteSemCard?: boolean
  ids?: number[]
  limite?: number
  deslocamento?: number
}

export async function pedidosResumo(filtro: FiltroPedidos = {}): Promise<PedidoResumo[]> {
  const { data, error } = await supabase.rpc('plt_fn_pedidos_kanban', {
    p_busca: filtro.busca ?? null,
    p_somente_sem_card: filtro.somenteSemCard ?? false,
    p_ids: filtro.ids ?? null,
    p_limite: filtro.limite ?? 20,
    p_deslocamento: filtro.deslocamento ?? 0,
  })
  return garantir(data as PedidoResumo[] | null, error, 'Não deu para carregar os pedidos')
}

export async function itensDoPedido(pedidoId: number): Promise<ItemKanban[]> {
  const { data, error } = await supabase.rpc('plt_fn_pedido_itens_kanban', {
    p_pedido_id: pedidoId,
  })
  return garantir(data as ItemKanban[] | null, error, 'Não deu para carregar os itens do pedido')
}

export interface FiltroExpedicao {
  busca?: string
  limite?: number
  deslocamento?: number
}

export async function expedicaoResumo(filtro: FiltroExpedicao = {}): Promise<ExpedicaoLinha[]> {
  const { data, error } = await supabase.rpc('plt_fn_expedicao_kanban', {
    p_busca: filtro.busca ?? null,
    p_limite: filtro.limite ?? 20,
    p_deslocamento: filtro.deslocamento ?? 0,
  })
  return garantir(data as ExpedicaoLinha[] | null, error, 'Não deu para carregar a expedição')
}

export async function unidadesDoPedido(pedidoId: number): Promise<UnidadePedido[]> {
  const { data, error } = await supabase.rpc('plt_fn_pedido_unidades', {
    p_pedido_id: pedidoId,
  })
  return garantir(
    data as UnidadePedido[] | null,
    error,
    'Não deu para carregar as unidades do pedido',
  )
}

// ---------------------------------------------------------------------------
// Gestos que geram evento (append-only — RNF-05)
// ---------------------------------------------------------------------------

interface NovoEvento {
  card_id: number
  tipo:
    | 'card_criado'
    | 'movimentacao_setor'
    | 'movimentacao_etapa'
    | 'execucao_pausada'
    | 'execucao_retomada'
  usuario_id: string
  setor_origem_id?: number | null
  etapa_origem_id?: number | null
  setor_destino_id?: number | null
  etapa_destino_id?: number | null
}

async function registrarEvento(evento: NovoEvento): Promise<void> {
  const { error } = await supabase.from('plt_eventos').insert({ ...evento, origem: 'interface' })
  if (error) throw new Error(`Não deu para registrar a movimentação: ${error.message}`)
}

/** Cria o card de PEDIDO no PCP (D-01) a partir de um pedido real do Tiny (D-22). */
export async function criarCardPedido(parametros: {
  pedidoId: number
  setorPcpId: number
  usuarioId: string
}): Promise<number> {
  const { data, error } = await supabase
    .from('plt_cards')
    .insert({
      tipo: 'pedido',
      pedido_id: parametros.pedidoId,
      setor_atual_id: parametros.setorPcpId,
    })
    .select('id')
    .single()
  const card = garantir(data as { id: number } | null, error, 'Não deu para criar o card')
  await registrarEvento({
    card_id: card.id,
    tipo: 'card_criado',
    usuario_id: parametros.usuarioId,
    setor_destino_id: parametros.setorPcpId,
  })
  return card.id
}

export interface LiberacaoUnidade extends UnidadeParaLiberar {
  destinoSetorId: number
  destinoEtapaId: number | null
}

/**
 * Libera unidades do pedido (D-01/D-22): cada uma nasce como card no PCP
 * (evento card_criado) e é movida ao setor escolhido (evento
 * movimentacao_setor). A liberação pode ser parcial — o que não foi liberado
 * continua no card de pedido.
 */
export async function liberarUnidades(parametros: {
  cardPaiId: number
  pedidoId: number
  setorPcpId: number
  usuarioId: string
  unidades: LiberacaoUnidade[]
}): Promise<number> {
  let liberadas = 0
  for (const unidade of parametros.unidades) {
    const { data, error } = await supabase
      .from('plt_cards')
      .insert({
        tipo: 'unidade',
        pedido_id: parametros.pedidoId,
        card_pai_id: parametros.cardPaiId,
        item_seq: unidade.item_seq,
        item_codigo: unidade.item_codigo,
        item_descricao: unidade.item_descricao,
        indice_unidade: unidade.indice_unidade,
        total_unidades: unidade.total_unidades,
        setor_atual_id: parametros.setorPcpId,
      })
      .select('id')
      .single()
    if (error || !data) {
      const detalhe = error?.message ?? 'sem resposta do servidor'
      throw new Error(
        liberadas === 0
          ? `Não deu para liberar: ${detalhe}`
          : `Liberei ${liberadas} unidade(s), mas parei em ${unidade.item_descricao ?? 'item'} (${unidade.indice_unidade}/${unidade.total_unidades}): ${detalhe}`,
      )
    }
    const cardId = (data as { id: number }).id
    await registrarEvento({
      card_id: cardId,
      tipo: 'card_criado',
      usuario_id: parametros.usuarioId,
      setor_destino_id: parametros.setorPcpId,
    })
    await registrarEvento({
      card_id: cardId,
      tipo: 'movimentacao_setor',
      usuario_id: parametros.usuarioId,
      setor_origem_id: parametros.setorPcpId,
      setor_destino_id: unidade.destinoSetorId,
      // `|| null`: id 0/NaN nunca é etapa válida — Number('') === 0 já rendeu FK violada.
      etapa_destino_id: unidade.destinoEtapaId || null,
    })
    liberadas += 1
  }
  return liberadas
}

/**
 * Move um card pela RPC da SESSAO-06 (plt_fn_mover_card): mesmo setor →
 * movimentação de etapa; setor diferente → marcação de qualidade + movimentação
 * NUMA transação (D-09). Saindo de setor de produção, o estado é obrigatório —
 * o banco recusa sem ele, com a mensagem já em português.
 */
export async function moverCard(parametros: {
  card: Card
  destinoSetorId: number
  destinoEtapaId: number | null
  /** 🟢🟡🔴 de quem entrega (D-09) — obrigatório ao sair de setor de produção. */
  estadoQualidade?: Estado | null
  /** Tablet compartilhado (SESSAO-07/D-06): o AUTOR é o operador do PIN, não a sessão. */
  operadorId?: string | null
}): Promise<void> {
  const { card, destinoSetorId, destinoEtapaId, estadoQualidade, operadorId } = parametros
  const mesmoSetor = card.setor_atual_id === destinoSetorId
  if (mesmoSetor && card.etapa_atual_id === destinoEtapaId) return
  const { error } = await supabase.rpc('plt_fn_mover_card', {
    p_card_id: card.id,
    p_setor_destino_id: destinoSetorId,
    // `|| null`: id 0/NaN nunca é etapa válida — Number('') === 0 já rendeu FK violada.
    p_etapa_destino_id: destinoEtapaId || null,
    p_estado_qualidade: estadoQualidade ?? null,
    p_operador_id: operadorId ?? null,
  })
  if (error) throw new Error(`Não deu para mover: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Qualidade nas transições (SESSAO-06 / D-09 / D-25)
// ---------------------------------------------------------------------------

/**
 * Marcações sem parecer dos cards informados — o que cada setor recebedor
 * ainda precisa responder. Fica só a da CHEGADA ATUAL de cada card (marcação
 * de chegada antiga é registro unilateral; o banco recusaria o parecer dela).
 *
 * SESSAO-22: a comparação é com a última chegada de SETOR do card, nunca com
 * `desde` — mover entre ETAPAS atualiza o `desde` e fazia a pendência sumir da
 * tela enquanto o banco (certo) seguia exigindo o parecer.
 */
export async function buscarPareceresPendentes(
  cards: Card[],
): Promise<Map<number, QualidadePendente>> {
  if (cards.length === 0) return new Map()
  const ids = cards.map((c) => c.id)
  const [pendencias, chegadas] = await Promise.all([
    supabase
      .from('plt_vw_qualidade_transicoes')
      .select(
        'evento_marcacao_id, card_id, setor_origem_id, setor_destino_id, usuario_remetente_id, estado_remetente, marcado_em',
      )
      .in('card_id', ids)
      .is('evento_parecer_id', null)
      .order('marcado_em', { ascending: false }),
    supabase
      .from('plt_eventos')
      .select('card_id, ocorrido_em')
      .in('card_id', ids)
      .eq('tipo', 'movimentacao_setor')
      .order('ocorrido_em', { ascending: false }),
  ])
  const linhas = garantir(
    pendencias.data as QualidadePendente[] | null,
    pendencias.error,
    'Não deu para carregar as pendências de qualidade',
  )
  const eventosChegada = garantir(
    chegadas.data as { card_id: number; ocorrido_em: string }[] | null,
    chegadas.error,
    'Não deu para carregar as chegadas',
  )
  // A última chegada de setor de cada card (a lista já vem do mais novo para o mais velho).
  const chegadaPorCard = new Map<number, number>()
  for (const e of eventosChegada) {
    if (!chegadaPorCard.has(e.card_id))
      chegadaPorCard.set(e.card_id, new Date(e.ocorrido_em).getTime())
  }
  const cardsPorId = new Map(cards.map((c) => [c.id, c]))
  const pendentes = new Map<number, QualidadePendente>()
  for (const linha of linhas) {
    const card = cardsPorId.get(linha.card_id)
    if (!card || pendentes.has(linha.card_id)) continue
    if (linha.setor_destino_id !== card.setor_atual_id) continue
    // Marcação de uma passagem ANTERIOR pelo mesmo setor não vale para agora.
    const chegouEm = chegadaPorCard.get(linha.card_id)
    if (chegouEm !== undefined && new Date(linha.marcado_em).getTime() < chegouEm) continue
    pendentes.set(linha.card_id, linha)
  }
  return pendentes
}

/**
 * O parecer de quem recebe (D-09): concorda ou registra o estado que enxerga.
 * Divergência não trava nada — vira registro e aviso automático à liderança;
 * 🔴 leva o card à etapa DANIFICADO sozinho. Tudo regra do banco.
 */
export async function registrarParecer(parametros: {
  marcacaoEventoId: number
  estado: Estado
  observacao?: string
  /** Tablet compartilhado (SESSAO-07/D-06): o AUTOR é o operador do PIN, não a sessão. */
  operadorId?: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_registrar_parecer', {
    p_marcacao_id: parametros.marcacaoEventoId,
    p_estado_qualidade: parametros.estado,
    p_observacao: parametros.observacao?.trim() || null,
    p_operador_id: parametros.operadorId ?? null,
  })
  if (error) throw new Error(`Não deu para registrar o parecer: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Execução e linha do tempo (SESSAO-05 / D-02 / D-24)
//
// Iniciar/finalizar são INSERTs de evento como qualquer gesto — as regras
// (iniciar obrigatório, limite por setor, transferência) vivem em trigger no
// banco e valem para todo escritor. O front só dá o clique e mostra o erro
// que o banco devolver, já em português.
// ---------------------------------------------------------------------------

/** Nomes de todo mundo (id → nome) — para o card dizer QUEM está executando. */
export async function buscarNomesUsuarios(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('plt_usuarios').select('id, nome')
  const linhas = garantir(
    data as { id: string; nome: string }[] | null,
    error,
    'Não deu para carregar os nomes',
  )
  return new Map(linhas.map((u) => [u.id, u.nome]))
}

/** Execuções em andamento nos cards informados — dá o "executando há X" do card. */
export async function buscarExecucoesAbertas(cardIds: number[]): Promise<ExecucaoAberta[]> {
  if (cardIds.length === 0) return []
  const { data, error } = await supabase
    .from('plt_vw_execucoes')
    .select('evento_inicio_id, card_id, usuario_inicio_id, iniciou_em')
    .in('card_id', cardIds)
    .eq('em_andamento', true)
  return garantir(
    data as ExecucaoAberta[] | null,
    error,
    'Não deu para carregar as execuções',
  )
}

/**
 * Iniciar (D-24): fecha a fila, abre a execução de quem clicou. Num card já em
 * execução por OUTRA pessoa, é a transferência — fecha para um, abre para o
 * outro; `transferido_de` fica gravado para a linha do tempo contar a história.
 */
export async function iniciarExecucao(parametros: {
  card: Card
  usuarioId: string
}): Promise<void> {
  const { card, usuarioId } = parametros
  const { error } = await supabase.from('plt_eventos').insert({
    card_id: card.id,
    tipo: 'execucao_iniciada',
    usuario_id: usuarioId,
    origem: 'interface',
    setor_origem_id: card.setor_atual_id,
    etapa_origem_id: card.etapa_atual_id,
    dados: card.executor_atual_id ? { transferido_de: card.executor_atual_id } : {},
  })
  if (error) throw new Error(`Não deu para iniciar: ${error.message}`)
}

/**
 * Pausar a execução de alguém (SESSAO-22/D-48): gesto de líder do setor do
 * card ou admin — a urgência do dia entra porque o pausado sai do limite.
 * A validação (quem pode, execução aberta, referência) vive no trigger do
 * banco e a mensagem volta já em português.
 */
export async function pausarExecucao(parametros: {
  card: Card
  usuarioId: string
}): Promise<void> {
  const { card, usuarioId } = parametros
  const { error } = await supabase.from('plt_eventos').insert({
    card_id: card.id,
    tipo: 'execucao_pausada',
    usuario_id: usuarioId,
    origem: 'interface',
    setor_origem_id: card.setor_atual_id,
    etapa_origem_id: card.etapa_atual_id,
  })
  if (error) throw new Error(`Não deu para pausar: ${error.message}`)
}

/**
 * Retomar a execução pausada (SESSAO-22/D-48): a própria pessoa retoma ao
 * finalizar a urgência (o banco recusa enquanto ela tiver outra execução
 * aberta no teto do setor); líder/admin também podem.
 */
export async function retomarExecucao(parametros: {
  card: Card
  usuarioId: string
}): Promise<void> {
  const { card, usuarioId } = parametros
  const { error } = await supabase.from('plt_eventos').insert({
    card_id: card.id,
    tipo: 'execucao_retomada',
    usuario_id: usuarioId,
    origem: 'interface',
    setor_origem_id: card.setor_atual_id,
    etapa_origem_id: card.etapa_atual_id,
  })
  if (error) throw new Error(`Não deu para retomar: ${error.message}`)
}

/** Finalizar (D-24): fecha a execução — o card fica pronto para ser movido. */
export async function finalizarExecucao(parametros: {
  card: Card
  usuarioId: string
}): Promise<void> {
  const { card, usuarioId } = parametros
  const { error } = await supabase.from('plt_eventos').insert({
    card_id: card.id,
    tipo: 'execucao_finalizada',
    usuario_id: usuarioId,
    origem: 'interface',
    setor_origem_id: card.setor_atual_id,
    etapa_origem_id: card.etapa_atual_id,
  })
  if (error) throw new Error(`Não deu para finalizar: ${error.message}`)
}

/**
 * Delegar/reatribuir um card (SESSAO-12/D-34): evento append-only com quem
 * delegou, para quem e o modo. O banco valida (líder do setor do card ou
 * admin); a delegação ORGANIZA — não trava gesto nenhum.
 */
export async function delegarCard(parametros: {
  card: Card
  responsavelId: string | null
  usuarioId: string
}): Promise<void> {
  const { error } = await supabase.from('plt_eventos').insert({
    card_id: parametros.card.id,
    tipo: 'delegacao',
    usuario_id: parametros.usuarioId,
    origem: 'interface',
    setor_origem_id: parametros.card.setor_atual_id,
    dados: { responsavel_id: parametros.responsavelId, modo: 'direta' },
  })
  if (error) throw new Error(`Não deu para delegar: ${error.message}`)
}

/** A história completa do card, com nomes — a linha do tempo (SESSAO-05). */
export async function linhaTempoCard(cardId: number): Promise<EventoLinhaTempo[]> {
  const { data, error } = await supabase.rpc('plt_fn_linha_tempo_card', {
    p_card_id: cardId,
  })
  return garantir(
    data as EventoLinhaTempo[] | null,
    error,
    'Não deu para carregar a linha do tempo',
  )
}

/**
 * Estorno (líder do setor do card ou admin — D-24): evento novo que anula o
 * gesto errado sem apagar nada (RNF-05). O banco valida quem pode e o quê.
 */
export async function estornarEvento(parametros: {
  eventoId: number
  observacao?: string
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_estornar_evento', {
    p_evento_id: parametros.eventoId,
    p_observacao: parametros.observacao ?? null,
  })
  if (error) throw new Error(`Não deu para estornar: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Gestão de estrutura (admin + líder do próprio setor — D-22, RLS por baixo)
// ---------------------------------------------------------------------------

/** Slug estável a partir do nome: "LIMPEZA E EMBALAGEM" → "limpeza-e-embalagem". */
export function codigoDeSetor(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function criarSetor(nome: string, ordem: number): Promise<void> {
  const { error } = await supabase.from('plt_setores').insert({
    nome: nome.trim().toUpperCase(),
    codigo: codigoDeSetor(nome),
    papel_no_fluxo: 'producao',
    ordem,
  })
  if (error) throw new Error(`Não deu para criar o setor: ${error.message}`)
}

/**
 * Limite de execuções por pessoa do setor (D-24/D-48): RPC com gate no banco —
 * líder ajusta o PRÓPRIO setor, admin qualquer um; null = sem limite. A troca
 * fica na trilha de atividade.
 */
export async function definirLimiteExecucoes(setorId: number, limite: number | null): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_definir_limite_execucoes', {
    p_setor_id: setorId,
    p_limite: limite,
  })
  if (error) throw new Error(`Não deu para salvar o limite: ${error.message}`)
}

export async function atualizarSetor(
  id: number,
  mudancas: Partial<
    Pick<Setor, 'nome' | 'ordem' | 'ativo' | 'limite_execucoes_por_pessoa' | 'modo_delegacao'>
  >,
): Promise<void> {
  const dados = { ...mudancas }
  if (dados.nome) dados.nome = dados.nome.trim().toUpperCase()
  const { error } = await supabase.from('plt_setores').update(dados).eq('id', id)
  if (error) throw new Error(`Não deu para atualizar o setor: ${error.message}`)
}

export async function criarEtapa(setorId: number, nome: string, ehFila: boolean): Promise<void> {
  const { data: existentes, error: erroOrdem } = await supabase
    .from('plt_etapas')
    .select('ordem')
    .eq('setor_id', setorId)
    .order('ordem', { ascending: false })
    .limit(1)
  if (erroOrdem) throw new Error(`Não deu para criar a etapa: ${erroOrdem.message}`)
  const ordem = ((existentes?.[0] as { ordem: number } | undefined)?.ordem ?? 0) + 1
  const { error } = await supabase
    .from('plt_etapas')
    .insert({ setor_id: setorId, nome: nome.trim(), ordem, eh_fila: ehFila })
  if (error) {
    if (/plt_etapas_fila_unica_por_setor/.test(error.message))
      // D-02: uma etapa de fila por setor — o código fica aqui, não na tela (D-27).
      throw new Error('Este setor já tem uma etapa de fila — só pode existir uma.')
    throw new Error(`Não deu para criar a etapa: ${error.message}`)
  }
}

export async function atualizarEtapa(
  id: number,
  mudancas: Partial<Pick<Etapa, 'nome' | 'ordem' | 'eh_fila' | 'ativa'>>,
): Promise<void> {
  const dados = { ...mudancas }
  if (dados.nome) dados.nome = dados.nome.trim()
  const { error } = await supabase.from('plt_etapas').update(dados).eq('id', id)
  if (error) {
    if (/plt_etapas_fila_unica_por_setor/.test(error.message))
      // D-02: uma etapa de fila por setor — o código fica aqui, não na tela (D-27).
      throw new Error('Este setor já tem uma etapa de fila — só pode existir uma.')
    throw new Error(`Não deu para atualizar a etapa: ${error.message}`)
  }
}
