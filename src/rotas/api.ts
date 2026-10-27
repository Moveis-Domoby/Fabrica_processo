import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { SituacaoCalendario } from './calendario'

/**
 * Camada de dados do módulo de ROTAS (SESSAO-11 / D-33, revista na SESSAO-15 /
 * D-39 / D-45): a entrega é por PEDIDO COMPLETO. ↪️ SESSAO-38 (D-156): a rota
 * aceita QUALQUER pedido vivo (pronto, em produção ou ainda no PCP) — o
 * "Lançar para ROTAS" deixou de ser passo; cada pedido diz o seu `estado`. O gate (logística: admin, PCP, terminais)
 * vive nas funções do banco. Endereço e contato aparecem de propósito — é o
 * que o entregador precisa (o mesmo que o card do ClickUp mostrava).
 */

/**
 * SESSAO-38 (D-156): pronto (todas as peças no fim de linha) · em produção
 * (alguma peça liberada) · no PCP (nada liberado ainda) · entregue.
 */
export type EstadoPedido = 'pronto' | 'em_producao' | 'no_pcp' | 'entregue'

/** O que a prontidão de um pedido traz (as portas da rota devolvem as três). */
export interface Prontidao {
  estado?: EstadoPedido | null
  unidades_prontas?: number
  unidades_liberadas?: number
}

export interface Entrega extends Prontidao {
  card_id: number
  pedido_id: number
  numero: number
  cliente_nome: string
  telefone: string | null
  endereco: string | null
  numero_endereco: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  obs: string | null
  data_prevista: string | null
  total_unidades: number
  unidades_em_rotas: number
  situacao_entrega: 'pronta' | 'entregue'
  entregue_em: string | null
  entregue_por: string | null
  lancado_em: string | null
  /** D-39: o dia e o caminhão programados, quando há. */
  programacao_data: string | null
  caminhao_id: number | null
  caminhao_nome: string | null
  caminhao_placa: string | null
  caminhao_foto: string | null
  contagem_total: number
}

export async function listarEntregas(parametros: {
  situacao?: string | null
  busca?: string
  limite?: number
  deslocamento?: number
}): Promise<Entrega[]> {
  const { data, error } = await supabase.rpc('plt_fn_rotas', {
    p_situacao: parametros.situacao ?? null,
    p_busca: parametros.busca || null,
    p_limite: parametros.limite ?? 20,
    p_deslocamento: parametros.deslocamento ?? 0,
  })
  if (error) throw new Error(`Não deu para carregar as rotas: ${error.message}`)
  return (data ?? []) as Entrega[]
}

/**
 * Marca o pedido como entregue (evento append-only; o banco valida). ↩️
 * SESSAO-38 (ajuste): pedido que ainda aparece em produção só com
 * `confirmarIncompleto` (a tela pergunta antes) — fecha tudo dele, como o Tiny.
 */
export async function registrarEntrega(parametros: {
  cardId: number
  observacao?: string
  confirmarIncompleto?: boolean
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_registrar_entrega', {
    p_card_id: parametros.cardId,
    p_observacao: parametros.observacao?.trim() || null,
    p_confirmar_incompleto: parametros.confirmarIncompleto ?? false,
  })
  if (error) throw new Error(`Não deu para registrar a entrega: ${error.message}`)
}

/** SESSAO-41 (D-195): uma peça viva do pedido, para marcar a entrega parcial. */
export interface PecaDaEntrega {
  id: number
  descricao: string | null
  item_seq: number | null
  indice: number | null
  total: number | null
  /** No fim de linha (Expedição ou ROTAS) — senão, a plataforma ainda a vê em produção. */
  pronta: boolean
  onde: string | null
}

/** As peças do pedido — só quando a janela da entrega parcial abre (Lei §3). */
export async function listarPecasDaEntrega(cardId: number): Promise<PecaDaEntrega[]> {
  const { data, error } = await supabase.rpc('plt_fn_entrega_pecas', { p_card_id: cardId })
  if (error) throw new Error(`Não deu para carregar as peças: ${error.message}`)
  return (data ?? []) as PecaDaEntrega[]
}

/**
 * SESSAO-41 (D-195): a ENTREGA PARCIAL — as peças entregues saem; as que
 * voltaram vão para "Em decisão pós devolução" (a logística decide). O Tiny
 * não muda. Motivo da lista e/ou observação (pelo menos um).
 */
export async function registrarEntregaParcial(parametros: {
  cardId: number
  entregues: number[]
  motivoId: number | null
  observacao?: string
  confirmarIncompleto?: boolean
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_entrega_parcial', {
    p_card_id: parametros.cardId,
    p_entregues: parametros.entregues,
    p_motivo_id: parametros.motivoId,
    p_observacao: parametros.observacao?.trim() || null,
    p_confirmar_incompleto: parametros.confirmarIncompleto ?? false,
  })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// SESSAO-30 (D-113/D-114/D-116): o que acontece na entrega além do "Entregue"
// ---------------------------------------------------------------------------

/** SESSAO-31: + 'devolucao' (D-129) e 'pausa' (D-125). SESSAO-36: + 'saida' (D-146 resp. 6). */
export type TipoMotivo = 'nao_entregue' | 'desfazer_entrega' | 'devolucao' | 'pausa' | 'saida'

/**
 * SESSAO-38 (D-169): + os motivos de STAND-BY do PCP. Tipo à parte (os modais
 * da entrega fazem um registro por TipoMotivo — o stand-by não é da entrega).
 * SESSAO-39 (D-173): + os motivos do botão MOVER, pelo mesmo motivo.
 */
export type TipoMotivoComStandby = TipoMotivo | 'standby' | 'mover' | 'entrega_parcial'

export interface Motivo {
  id: number
  tipo: TipoMotivoComStandby
  texto: string
  ordem: number
  ativo: boolean
}

/** Os motivos de uma lista (Configurações → Utilitários). `todos` = com os desligados (só admin). */
export async function listarMotivos(tipo: TipoMotivoComStandby, todos = false): Promise<Motivo[]> {
  const { data, error } = await supabase.rpc('plt_fn_motivos', { p_tipo: tipo, p_todos: todos })
  if (error) throw new Error(`Não deu para carregar os motivos: ${error.message}`)
  return (data ?? []) as Motivo[]
}

export async function salvarMotivo(parametros: {
  id: number | null
  tipo: TipoMotivoComStandby
  texto: string
  ordem?: number | null
  ativo?: boolean
}): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_motivo_salvar', {
    p_id: parametros.id,
    p_tipo: parametros.tipo,
    p_texto: parametros.texto.trim(),
    p_ordem: parametros.ordem ?? null,
    p_ativo: parametros.ativo ?? true,
  })
  if (error) throw new Error(error.message)
  return Number(data)
}

/** Desfaz a entrega do dia (com motivo): as peças voltam à ROTAS e o Tiny volta junto. */
export async function desfazerEntrega(parametros: {
  cardId: number
  motivoId: number
  observacao?: string
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_entrega_desfazer', {
    p_card_id: parametros.cardId,
    p_motivo_id: parametros.motivoId,
    p_observacao: parametros.observacao?.trim() || null,
  })
  if (error) throw new Error(error.message)
}

/** Não entregue (com motivo): o pedido volta para "Programar"; o Tiny não muda. */
export async function marcarNaoEntregue(parametros: {
  cardId: number
  motivoId: number
  observacao?: string
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_entrega_nao_realizada', {
    p_card_id: parametros.cardId,
    p_motivo_id: parametros.motivoId,
    p_observacao: parametros.observacao?.trim() || null,
  })
  if (error) throw new Error(error.message)
}

/**
 * "Pedido devolvido" — ↩️ SESSAO-31 (D-129): gesto da LOGÍSTICA (o entregador
 * não tem mais esse botão), com motivo. As peças voltam para a fábrica e ficam
 * em "Em decisão pós devolução" (continuam do pedido); a logística decide no
 * Estoque. Pedido já entregue: as peças escolhidas voltam. O Tiny não muda.
 */
export async function marcarDevolvido(parametros: {
  cardId: number
  motivoId: number
  observacao?: string
  /** Pedido já entregue: só as peças que voltaram (vazio = todas). */
  pecas?: number[]
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_pedido_devolver', {
    p_card_id: parametros.cardId,
    p_motivo_id: parametros.motivoId,
    p_observacao: parametros.observacao?.trim() || null,
    p_pecas: parametros.pecas && parametros.pecas.length > 0 ? parametros.pecas : null,
  })
  if (error) throw new Error(error.message)
}

/** A chave "Entregue vai ao Tiny" e a fila (só admin vê; só o super admin liga). */
export interface SituacaoEntregaTiny {
  ligado_desde: string | null
  ultimo_ok_em: string | null
  pausado: boolean
  esperando: number
  parados: {
    pedido_id: number
    numero: number
    situacao: string
    erro: string | null
    parado_em: string
  }[]
}

export async function situacaoEntregaTiny(): Promise<SituacaoEntregaTiny | null> {
  const { data, error } = await supabase.rpc('plt_fn_tiny_entrega_situacao')
  if (error) throw new Error(error.message)
  return (data ?? null) as SituacaoEntregaTiny | null
}

export async function ligarEntregaTiny(ligar: boolean): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_tiny_entrega_ligar', { p_ligar: ligar })
  if (error) throw new Error(error.message)
}

export async function reenviarEntregaTiny(pedidoId: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_tiny_entrega_reenviar', { p_pedido_id: pedidoId })
  if (error) throw new Error(error.message)
}

/** A entrega foi hoje (no fuso do galpão)? Só a do dia se desfaz (D-113). */
export function entregueHoje(entregueEm: string | null, agora = new Date()): boolean {
  if (!entregueEm) return false
  const dia = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' })
  return dia(new Date(entregueEm)) === dia(agora)
}

/** Endereço em linha única (o formato do card real de entrega). */
export function enderecoLegivel(e: {
  endereco: string | null
  numero_endereco: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
}): string {
  const partes = [
    [e.endereco, e.numero_endereco].filter(Boolean).join(', '),
    e.bairro,
    [e.cidade, e.uf].filter(Boolean).join('-'),
  ].filter(Boolean)
  return partes.join(' · ') || 'Sem endereço cadastrado'
}

/** Data ISO (aaaa-mm-dd) em dd/mm/aaaa; nula vira "—". */
export function dataLegivel(iso: string | null): string {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '—'
}

/** Link do WhatsApp (wa.me) a partir do telefone cru. */
export function linkWhatsApp(telefone: string | null): string | null {
  const digitos = (telefone ?? '').replace(/\D/g, '')
  if (digitos.length < 10) return null
  return `https://wa.me/55${digitos}`
}

/** Link do mapa, como no card real. */
export function linkMapa(e: Entrega): string | null {
  const endereco = [e.endereco, e.numero_endereco, e.bairro, e.cidade, e.uf]
    .filter(Boolean)
    .join(', ')
  if (!endereco) return null
  return `https://www.google.com/maps/search/${encodeURIComponent(endereco)}`
}

// ---------------------------------------------------------------------------
// Programação de caminhão (D-39/D-45)
// ---------------------------------------------------------------------------

/** Um móvel do pedido (D-111): a descrição e a quantidade — o frete não vem. */
export interface ItemPedido {
  descricao: string
  quantidade: number
}

export interface PedidoProgramacao extends Prontidao {
  card_id: number
  pedido_id: number
  numero: number
  cliente_nome: string
  endereco: string | null
  numero_endereco: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  /** O que se manda ao geocodificador; null = sem endereço nenhum. */
  endereco_geocodificavel: string | null
  /** Chave do cache, calculada no banco (md5 do endereço normalizado). */
  geo_chave: string | null
  latitude: number | null
  longitude: number | null
  /** null = nunca consultado; false = consultado e sem ponto (Q-65). */
  geo_resolvido: boolean | null
  geo_consultado_em: string | null
  total_unidades: number
  /** D-111: os móveis do pedido, na ordem, sem o frete. */
  itens: ItemPedido[]
  data_prevista: string | null
  lancado_em: string | null
  programacao_data: string | null
  caminhao_id: number | null
  caminhao_nome: string | null
  /** D-109: a posição salva à mão na rota do caminhão; null = vale a sugestão. */
  ordem: number | null
  contagem_total: number
}

/**
 * Os pedidos da programação: SEM programação (sempre) + os programados no dia
 * pedido (a não ser com `soSemProgramacao` — a aba "Programar", D-111). Vem com
 * o ponto do cache quando já geocodificado e com os móveis de cada pedido.
 */
export async function listarProgramacao(parametros: {
  data?: string | null
  soSemProgramacao?: boolean
  limite?: number
  deslocamento?: number
}): Promise<PedidoProgramacao[]> {
  const { data, error } = await supabase.rpc('plt_fn_programacao', {
    p_data: parametros.data ?? null,
    p_limite: parametros.limite ?? 100,
    p_deslocamento: parametros.deslocamento ?? 0,
    p_so_sem_programacao: parametros.soSemProgramacao ?? false,
  })
  if (error) throw new Error(`Não deu para carregar a programação: ${error.message}`)
  return (data ?? []) as PedidoProgramacao[]
}

/** SESSAO-41 (D-199): a situação do pedido que o filtro da aba Programar aceita. */
export type EstadoFiltro = 'pronto' | 'em_producao' | 'no_pcp'
/** A previsão de entrega: a semana é a do calendário (domingo a sábado). */
export type PrevisaoFiltro = 'atrasados' | 'hoje' | 'semana' | 'quinze' | 'sem'
/** A ordem que o SERVIDOR aplica ("mais perto" é da tela — depende da rota montada). */
export type OrdemCandidatos =
  | 'entrega'
  | 'numero'
  | 'cliente_az'
  | 'cliente_za'
  | 'pecas'
  | 'mais_novo'
  | 'mais_antigo'

export interface FiltrosCandidatos {
  busca: string | null
  estado: EstadoFiltro | null
  cidade: string | null
  bairro: string | null
  previsao: PrevisaoFiltro | null
  ordem: OrdemCandidatos
}

export interface CandidatosProgramacao {
  itens: PedidoProgramacao[]
  /** Quantos batem com os filtros (a lista mostra até 200). */
  total: number
  /** Quantos estão sem programação, sem filtro nenhum. */
  total_geral: number
  /** Quantos há de cada situação e previsão (sobre todos os sem programação). */
  contagens: Record<EstadoFiltro | PrevisaoFiltro, number>
  cidades: { cidade: string; uf: string | null; n: number }[]
  /** Os bairros da cidade escolhida (ou de todas), cada um com a sua cidade. */
  bairros: { bairro: string; cidade: string; n: number }[]
}

/**
 * SESSAO-41 (D-199, pedido do dono): os pedidos sem programação da aba
 * Programar, filtrados e ordenados NO SERVIDOR — com o total, as contagens e as
 * cidades/bairros (as opções dos filtros) na mesma requisição (Lei §2).
 */
export async function listarCandidatos(
  filtros: FiltrosCandidatos,
  limite = 200,
): Promise<CandidatosProgramacao> {
  const { data, error } = await supabase.rpc('plt_fn_programacao_candidatos', {
    p_busca: filtros.busca,
    p_estado: filtros.estado,
    p_cidade: filtros.cidade,
    p_bairro: filtros.bairro,
    p_previsao: filtros.previsao,
    p_ordem: filtros.ordem,
    p_limite: limite,
  })
  if (error) throw new Error(`Não deu para carregar os pedidos sem programação: ${error.message}`)
  return data as CandidatosProgramacao
}

/**
 * Programar ou reprogramar (D-45): data + caminhão + rota (D-128 — sem rota,
 * fica na que já está ou entra na última do caminhão); o banco recusa depois
 * de entregue.
 */
export async function programarEntrega(parametros: {
  cardId: number
  data: string
  caminhaoId: number
  rota?: number | null
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_programar_entrega', {
    p_card_id: parametros.cardId,
    p_data: parametros.data,
    p_caminhao_id: parametros.caminhaoId,
    p_rota: parametros.rota ?? null,
  })
  if (error) throw new Error(`Não deu para programar: ${error.message}`)
}

/**
 * Programar a rota inteira numa chamada só (D-111): os pedidos no dia,
 * caminhão e ROTA (D-128) e, se vier, a ordem dessa rota. Tudo ou nada.
 */
export async function programarRota(parametros: {
  data: string
  caminhaoId: number
  rota: number
  cardIds: number[]
  ordem: number[] | null
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_programar_rota', {
    p_data: parametros.data,
    p_caminhao_id: parametros.caminhaoId,
    p_card_ids: parametros.cardIds,
    p_ordem: parametros.ordem,
    p_rota: parametros.rota,
  })
  if (error) throw new Error(`Não deu para programar: ${error.message}`)
}

/** Uma entrega já programada (aba "Já programadas" — D-111). */
export interface PedidoProgramado extends Prontidao {
  card_id: number
  pedido_id: number
  numero: number
  cliente_nome: string
  endereco: string | null
  numero_endereco: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  geo_chave: string | null
  latitude: number | null
  longitude: number | null
  geo_resolvido: boolean | null
  /**
   * SESSAO-41 (D-193): o endereço (de entrega, quando há) montado no banco e
   * quando o ponto foi procurado — para achar o ponto que falta também aqui.
   */
  endereco_geocodificavel?: string | null
  geo_consultado_em?: string | null
  total_unidades: number
  itens: ItemPedido[]
  data_prevista: string | null
  programacao_data: string
  caminhao_id: number
  caminhao_nome: string | null
  caminhao_placa: string | null
  /** SESSAO-31 (D-128): a rota do caminhão naquele dia (1, 2, 3…). */
  rota: number
  ordem: number | null
  /** SESSAO-37 (pedido do dono, 19/10): os nomes da equipe da rota — aparece no card. */
  equipe?: string[]
  entregue_em: string | null
  /** SESSAO-30 (D-115): o detalhe da entrega escrito por quem programou. */
  detalhe: string | null
  contagem_total: number
}

/**
 * As programações (D-111), paginadas no servidor: as que ainda não foram
 * entregues (dia mais perto primeiro) ou, com `entregues`, o histórico.
 */
export async function listarProgramadas(parametros: {
  entregues?: boolean
  data?: string | null
  caminhaoId?: number | null
  limite?: number
  deslocamento?: number
  /** SESSAO-41 (D-199): a busca acha a ROTA inteira (pedido ou parada avulsa que bate). */
  busca?: string | null
}): Promise<PedidoProgramado[]> {
  const { data, error } = await supabase.rpc('plt_fn_programadas', {
    p_entregues: parametros.entregues ?? false,
    p_data: parametros.data ?? null,
    p_caminhao_id: parametros.caminhaoId ?? null,
    p_limite: parametros.limite ?? 50,
    p_deslocamento: parametros.deslocamento ?? 0,
    p_busca: parametros.busca ?? null,
  })
  if (error) throw new Error(`Não deu para carregar as programações: ${error.message}`)
  return (data ?? []) as PedidoProgramado[]
}

export async function desprogramarEntrega(cardId: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_desprogramar_entrega', { p_card_id: cardId })
  if (error) throw new Error(`Não deu para tirar da programação: ${error.message}`)
}

/** Quantos endereços por chamada à função (o mesmo teto do lado dela). */
export const GEOCODIFICAR_POR_CHAMADA = 5

export interface ResultadoGeocodificacao {
  chave: string
  latitude: number | null
  longitude: number | null
  resolvido: boolean
}

/**
 * Geocodificação pela Edge Function `geocodificar` (Nominatim com ritmo e
 * identificação — o navegador não consegue garantir nenhum dos dois). Até 5
 * por chamada (D-112: 3 tentativas por endereço); o resultado já fica no cache.
 */
export async function geocodificar(
  itens: { chave: string; endereco: string }[],
): Promise<ResultadoGeocodificacao[]> {
  if (itens.length === 0) return []
  const { data, error } = await supabase.functions.invoke('geocodificar', {
    body: { itens: itens.slice(0, GEOCODIFICAR_POR_CHAMADA) },
  })
  if (error) {
    let mensagem = 'Não consegui consultar o mapa. Confira a internet e tente de novo.'
    if (error instanceof FunctionsHttpError) {
      try {
        const corpo = (await error.context.json()) as { erro?: string }
        if (corpo.erro) mensagem = corpo.erro
      } catch {
        // corpo não era JSON — fica a mensagem genérica
      }
    }
    throw new Error(mensagem)
  }
  return (data as { resultados?: ResultadoGeocodificacao[] })?.resultados ?? []
}

/**
 * "Salvar ordem" (D-109): a ordem das paradas de UMA rota de um caminhão num
 * dia (D-128). Lista vazia = volta à sugestão automática. O banco recusa se a
 * rota mudou noutra tela, se alguém já foi entregue ou se quem salva não é da
 * logística.
 */
export async function ordenarRota(parametros: {
  data: string
  caminhaoId: number
  rota: number
  cardIds: number[]
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_ordenar_rota', {
    p_data: parametros.data,
    p_caminhao_id: parametros.caminhaoId,
    p_card_ids: parametros.cardIds,
    p_rota: parametros.rota,
  })
  if (error) throw new Error(`Não deu para salvar a ordem: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Rota pelas ruas (SESSAO-28 / D-108)
// ---------------------------------------------------------------------------

export interface RotaCalculada {
  distancia_m: number
  duracao_s: number
  trechos: { distancia_m: number; duracao_s: number }[]
  /** A linha no formato compacto do serviço (polyline, precisão 5). */
  geometria: string
  servidor: string
}

export type ResultadoRota =
  { tipo: 'pronta'; rota: RotaCalculada; doCache: boolean } | { tipo: 'sem_caminho' }

/** "Não existe caminho" guardado vale por 7 dias (a Edge Function também não insiste). */
const SEM_CAMINHO_VALE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * A rota pelas ruas para a sequência de pontos (já com a fábrica na ida e na
 * volta). Primeiro o cache do mapa — reabrir a mesma programação é UMA leitura
 * barata, sem chamar o serviço; só o que nunca foi calculado vai à Edge
 * Function `calcular-rota` (que chama o serviço gratuito de rotas, identificada,
 * e guarda). Serviço fora do ar → erro (a tela cai na linha reta com aviso).
 */
export async function buscarRotaPelasRuas(
  chave: string,
  pontos: { latitude: number; longitude: number }[],
): Promise<ResultadoRota> {
  const { data: guardada } = await supabase
    .from('plt_geocache')
    .select('resolvido, rota, consultado_em')
    .eq('chave', chave)
    .maybeSingle()
  if (guardada?.resolvido && guardada.rota) {
    return { tipo: 'pronta', rota: guardada.rota as RotaCalculada, doCache: true }
  }
  if (
    guardada &&
    !guardada.resolvido &&
    Date.now() - new Date(guardada.consultado_em as string).getTime() < SEM_CAMINHO_VALE_MS
  ) {
    return { tipo: 'sem_caminho' }
  }

  const { data, error } = await supabase.functions.invoke('calcular-rota', {
    body: { pontos: pontos.map((p) => [p.latitude, p.longitude]) },
  })
  if (error) throw new Error('O serviço de rotas não respondeu agora.')
  const resposta = data as { chave?: string; resolvido?: boolean; rota?: RotaCalculada | null }
  if (resposta.chave && resposta.chave !== chave) {
    // A chave da tela e a da função do servidor saíram diferentes: o formato
    // mudou num lado só (rotaRuas.ts × calcular-rota) — a rota vale, o cache
    // da tela é que não vai achá-la na próxima vez.
    console.warn('rota: a chave da tela e a do servidor divergem', {
      tela: chave,
      servidor: resposta.chave,
    })
  }
  if (resposta.resolvido && resposta.rota)
    return { tipo: 'pronta', rota: resposta.rota, doCache: false }
  return { tipo: 'sem_caminho' }
}

/** Falha de geocodificação vale por 7 dias (a Edge Function também não insiste). */
const RETENTAR_APOS_MS = 7 * 24 * 60 * 60 * 1000

/** Quem ainda precisa ir ao geocodificador. */
export function precisaGeocodificar(
  p: Pick<PedidoProgramacao, 'geo_chave' | 'geo_resolvido'> & {
    endereco_geocodificavel?: string | null
    geo_consultado_em?: string | null
  },
  agora = Date.now(),
): boolean {
  if (!p.geo_chave || !p.endereco_geocodificavel) return false
  if (p.geo_resolvido === true) return false
  if (p.geo_resolvido === null) return true
  const consultado = p.geo_consultado_em ? new Date(p.geo_consultado_em).getTime() : 0
  return agora - consultado > RETENTAR_APOS_MS
}

// ---------------------------------------------------------------------------
// SESSAO-30 (D-115): o entregador — "Entregas do dia", equipe do caminhão,
// detalhe da entrega, comentário e comprovante
// ---------------------------------------------------------------------------

export interface ItemEntrega {
  descricao: string
  quantidade: number
  volumes: number
}

export interface ComentarioEntrega {
  texto: string
  por: string | null
  em: string
}

export interface EntregaDoDia {
  posicao: number
  /**
   * SESSAO-39 (D-174): a ordem salva da rota (nula = vale a sugestão). Com ela a
   * tela numera como "Já programadas"; ausente = o banco de antes desta sessão.
   */
  ordem?: number | null
  card_id: number
  pedido_id: number
  numero: number
  cliente_nome: string
  telefone: string | null
  endereco: string | null
  numero_endereco: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  latitude: number | null
  longitude: number | null
  obs: string | null
  /** O detalhe escrito por quem programou ("só depois das 10h"). */
  detalhe: string | null
  data_prevista: string | null
  itens: ItemEntrega[]
  unidades: number
  /** Volumes do cadastro do Tiny (produto com mais de um volume — montado na entrega). */
  volumes: number
  entregue_em: string | null
  entregue_por: string | null
  entregue_por_gente: boolean
  /** SESSAO-41 (D-195): a entrega foi parcial (as que voltaram estão com a logística). */
  entrega_parcial?: boolean
  comprovantes: number
  comentarios: ComentarioEntrega[]
  /** SESSAO-38 (D-156): o programado pode ainda estar em produção. */
  estado?: EstadoPedido | null
  pronto?: boolean
  prontas?: number
  a_entregar?: number
}

/** SESSAO-31 (D-128): um item por ROTA do dia (o caminhão + o número da rota). */
export interface CaminhaoDoDia {
  id: number
  rota: number
  nome: string
  placa: string | null
  foto: string | null
  equipe: string[]
  entregas: number
}

export interface EntregasDoDia {
  data: string
  caminhao_id: number | null
  rota: number | null
  caminhoes: CaminhaoDoDia[]
  entregas: EntregaDoDia[]
  /**
   * SESSAO-41 (D-196): as paradas avulsas da rota escolhida, na ordem (a mesma
   * sequência das entregas — `ordem` dividida). Ausente = o banco de antes
   * desta sessão (a tela trata como nenhuma).
   */
  paradas_avulsas?: ParadaAvulsa[]
  sou_logistica: boolean
}

/** A tela do entregador numa requisição só (Lei §2). */
export async function entregasDoDia(
  parametros: { data?: string | null; caminhaoId?: number | null; rota?: number | null } = {},
): Promise<EntregasDoDia> {
  const { data, error } = await supabase.rpc('plt_fn_entregas_do_dia', {
    p_data: parametros.data ?? null,
    p_caminhao_id: parametros.caminhaoId ?? null,
    p_rota: parametros.rota ?? null,
  })
  if (error) throw new Error(`Não deu para carregar as entregas: ${error.message}`)
  return data as EntregasDoDia
}

export async function comentarNoCard(cardId: number, texto: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_card_comentar', {
    p_card_id: cardId,
    p_texto: texto.trim(),
  })
  if (error) throw new Error(error.message)
}

const ARMARIO = 'plt-anexos'
export const TIPOS_COMPROVANTE =
  'image/*,application/pdf,.pdf,.doc,.docx,.odt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const LIMITE_ARQUIVO = 10 * 1024 * 1024

/**
 * Foto reduzida NO APARELHO antes de subir (Lei §9): o lado maior vai a 1600 px
 * em JPEG; PDF, Word e o que o navegador não sabe desenhar (HEIC) vão como estão.
 */
export async function reduzirSeForFoto(arquivo: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) return arquivo
  try {
    const bitmap = await createImageBitmap(arquivo)
    const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    if (escala === 1 && arquivo.size < 1.5 * 1024 * 1024) return arquivo
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.8))
    if (!blob) return arquivo
    return new File([blob], arquivo.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return arquivo
  }
}

/**
 * O comprovante sobe DIRETO ao armário privado (não passa pelo banco); depois o
 * banco registra o anexo no card. O caminho começa pelo card — é o que a regra
 * do armário confere.
 */
export async function anexarComprovante(cardId: number, original: File): Promise<void> {
  const arquivo = await reduzirSeForFoto(original)
  if (arquivo.size > LIMITE_ARQUIVO)
    throw new Error('O arquivo tem mais de 10 MB — mande uma foto ou um PDF menor.')
  const nomeLimpo =
    arquivo.name
      .normalize('NFD')
      .replace(/[^\w.-]+/g, '-')
      .slice(-80) || 'comprovante'
  const caminho = `${cardId}/${crypto.randomUUID()}-${nomeLimpo}`
  const envio = await supabase.storage.from(ARMARIO).upload(caminho, arquivo, {
    contentType: arquivo.type || 'application/octet-stream',
    upsert: false,
  })
  if (envio.error) throw new Error(`Não deu para enviar o arquivo: ${envio.error.message}`)
  const { error } = await supabase.rpc('plt_fn_anexo_registrar', {
    p_card_id: cardId,
    p_caminho: caminho,
    p_nome_arquivo: original.name,
    p_mime: arquivo.type || 'application/octet-stream',
    p_tamanho: arquivo.size,
    p_tipo: 'comprovante',
  })
  if (error) throw new Error(error.message)
}

export interface Anexo {
  id: number
  tipo: string
  caminho: string
  nome_arquivo: string
  mime: string
  tamanho: number
  enviado_por_nome: string | null
  enviado_em: string
}

export async function listarAnexos(cardId: number): Promise<Anexo[]> {
  const { data, error } = await supabase.rpc('plt_fn_anexos', { p_card_id: cardId })
  if (error) throw new Error(error.message)
  return (data ?? []) as Anexo[]
}

/** Link de poucos minutos para abrir o comprovante (o armário é privado). */
export async function linkDoAnexo(caminho: string): Promise<string> {
  const { data, error } = await supabase.storage.from(ARMARIO).createSignedUrl(caminho, 300)
  if (error || !data) throw new Error('Não deu para abrir o arquivo.')
  return data.signedUrl
}

export interface PessoaEntregadora {
  id: string
  nome: string
  foto_caminho: string | null
  /** SESSAO-38 (D-158): a lista só traz entregador — sempre true. */
  entregador: boolean
}

export async function listarEntregadores(): Promise<PessoaEntregadora[]> {
  const { data, error } = await supabase.rpc('plt_fn_entregadores')
  if (error) throw new Error(error.message)
  return (data ?? []) as PessoaEntregadora[]
}

/** SESSAO-31 (D-128): uma rota do dia — o caminhão, o número, as entregas e a equipe. */
export interface RotaDoDia {
  caminhao_id: number
  rota: number
  entregas: number
  entregues: number
  equipe: { id: string; nome: string }[]
}

/** As rotas de um dia (só ao abrir o modal que precisa — regra 17). */
export async function rotasDoDia(dataIso: string): Promise<RotaDoDia[]> {
  const { data, error } = await supabase.rpc('plt_fn_rotas_do_dia', { p_data: dataIso })
  if (error) throw new Error(`Não deu para carregar as rotas do dia: ${error.message}`)
  return (data ?? []) as RotaDoDia[]
}

/** "Rota 2" — o nome de gente da rota do caminhão no dia. */
export function nomeDaRota(rota: number): string {
  return `Rota ${rota}`
}

export async function definirEquipe(
  dataIso: string,
  caminhaoId: number,
  usuarios: string[],
  rota: number,
): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_equipe_definir', {
    p_data: dataIso,
    p_caminhao_id: caminhaoId,
    p_usuarios: usuarios,
    p_rota: rota,
  })
  if (error) throw new Error(error.message)
}

export async function salvarDetalheEntrega(cardId: number, detalhe: string): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_programacao_detalhe', {
    p_card_id: cardId,
    p_detalhe: detalhe,
  })
  if (error) throw new Error(error.message)
}

/** Admin: tornar (ou deixar de ser) entregador — só "Entregas do dia" (D-115). */
export async function definirEntregador(usuarioId: string, entregador: boolean): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_usuario_entregador', {
    p_usuario_id: usuarioId,
    p_entregador: entregador,
  })
  if (error) throw new Error(error.message)
}

/** O mapa do endereço (o ponto, quando há; senão a busca pelo texto). */
export function linkMapaEntrega(e: EntregaDoDia): string | null {
  if (e.latitude !== null && e.longitude !== null)
    return `https://www.google.com/maps/search/?api=1&query=${e.latitude},${e.longitude}`
  const endereco = [e.endereco, e.numero_endereco, e.bairro, e.cidade, e.uf]
    .filter(Boolean)
    .join(', ')
  return endereco ? `https://www.google.com/maps/search/${encodeURIComponent(endereco)}` : null
}

// ---------------------------------------------------------------------------
// SESSAO-39 (D-175): o CALENDÁRIO da programação — uma requisição por tela
// ---------------------------------------------------------------------------

export interface ItemCalendario {
  situacao: SituacaoCalendario
  /** O card do pedido (abre a janela do card). */
  card_id: number
  /** O pedido (a ficha do pedido, no clique). */
  pedido_id: number
  numero: number
  bairro: string | null
  /** A previsão de entrega (a do vendedor no Tiny). */
  previsao: string | null
  /** O detalhe escrito por quem programou ("entre 13:30 e 17:00"). */
  detalhe: string | null
  caminhao_id: number | null
  caminhao_nome: string | null
  rota: number | null
  ordem: number | null
  /** O motivo do "não entregue" ou do stand-by. */
  motivo: string | null
}

export interface DiaCalendario {
  dia: string
  total: number
  contagem: Record<SituacaoCalendario, number>
  itens: ItemCalendario[]
}

export interface CalendarioRotas {
  de: string
  ate: string
  hoje: string
  por_dia: number
  /** Só os dias que têm alguma coisa. */
  dias: DiaCalendario[]
  /** O que não cabe em dia nenhum: sem rota com a previsão vencida e sem previsão. */
  fora: { atrasados_sem_rota: number; sem_previsao: number }
}

export async function calendarioRotas(parametros: {
  de: string
  ate: string
  porDia?: number
  deslocamento?: number
}): Promise<CalendarioRotas> {
  const { data, error } = await supabase.rpc('plt_fn_rotas_calendario', {
    p_de: parametros.de,
    p_ate: parametros.ate,
    p_por_dia: parametros.porDia ?? 30,
    p_deslocamento: parametros.deslocamento ?? 0,
  })
  if (error) throw new Error(`Não deu para carregar o calendário: ${error.message}`)
  return data as CalendarioRotas
}

// ---------------------------------------------------------------------------
// SESSAO-41 (D-196): a PARADA AVULSA da rota — buscar material, levar uma peça,
// passar num endereço. Não é pedido (sem card, estoque, Tiny ou Expedição):
// mora na rota (dia + caminhão + rota) e divide a ORDEM com os pedidos.
// ---------------------------------------------------------------------------

export type SituacaoParadaAvulsa = 'pendente' | 'feita' | 'nao_feita'

export interface ParadaAvulsa {
  id: number
  data: string
  caminhao_id: number
  rota: number
  /** A posição na rota — a mesma sequência dos pedidos (nula = ainda sem lugar salvo). */
  ordem: number | null
  titulo: string
  endereco: string
  /** O pino (ajustável); sem ele, a navegação vai pelo endereço escrito. */
  latitude: number | null
  longitude: number | null
  observacao: string | null
  situacao: SituacaoParadaAvulsa
  /** O nome de quem pôs a parada. */
  criada_por: string | null
  /** Fui eu quem pôs — o entregador só muda o lugar (e tira) a parada dele, enquanto pendente. */
  sou_autor: boolean
  concluida_em: string | null
  nao_feita_motivo: string | null
}

/** Um item da ORDEM da rota como o banco recebe: pedido (card) ou parada avulsa. */
export type ItemDaOrdem = { t: 'p'; id: number } | { t: 'a'; id: number }

/** Na aba Programar: o pedido (card) ou a parada nova, pela chave da tela. */
export type ItemDaMontagem = { t: 'p'; id: number } | { t: 'n'; k: string }

/** O que a pessoa escreve na parada (a janela "Parada avulsa"). */
export interface DadosParadaAvulsa {
  titulo: string
  endereco: string
  latitude: number | null
  longitude: number | null
  observacao: string | null
}

/**
 * Põe (sem `id`) ou edita a parada. `ordem` = a ordem INTEIRA da rota com
 * `{ t: 'nova' }` no lugar da parada nova (sem ela, vai para o fim). `chave` =
 * o gesto (o toque repetido devolve a mesma parada). A logística põe em
 * qualquer rota; o entregador, só na rota de HOJE em que está na equipe.
 */
export async function salvarParadaAvulsa(
  parametros: DadosParadaAvulsa & {
    id?: number | null
    data: string
    caminhaoId: number
    rota: number
    ordem?: (ItemDaOrdem | { t: 'nova' })[] | null
    chave?: string | null
  },
): Promise<{ id: number; repetido: boolean }> {
  const { data, error } = await supabase.rpc('plt_fn_parada_avulsa_salvar', {
    p_id: parametros.id ?? null,
    p_data: parametros.data,
    p_caminhao_id: parametros.caminhaoId,
    p_rota: parametros.rota,
    p_titulo: parametros.titulo.trim(),
    p_endereco: parametros.endereco.trim(),
    p_latitude: parametros.latitude,
    p_longitude: parametros.longitude,
    p_observacao: parametros.observacao?.trim() || null,
    p_ordem: parametros.ordem ?? null,
    p_chave: parametros.chave ?? null,
  })
  if (error) throw new Error(error.message)
  const resposta = data as { id: number | string; repetido?: boolean }
  return { id: Number(resposta.id), repetido: Boolean(resposta.repetido) }
}

/**
 * A ordem da rota com pedidos E paradas: TODOS os itens (pedidos ainda não
 * entregues + paradas não removidas, as feitas também). Faltou ou sobrou item
 * → o banco recusa ("a rota mudou noutra tela"). O entregador só muda o lugar
 * das paradas que ele pôs e que estão pendentes (o banco confere).
 */
export async function ordenarRotaComParadas(parametros: {
  data: string
  caminhaoId: number
  rota: number
  itens: ItemDaOrdem[]
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_rota_ordenar', {
    p_data: parametros.data,
    p_caminhao_id: parametros.caminhaoId,
    p_rota: parametros.rota,
    p_itens: parametros.itens,
  })
  if (error) throw new Error(error.message)
}

/** Feita (`true`), Não feita (`false`, motivo opcional) ou desfazer (`null` — volta a pendente). */
export async function concluirParadaAvulsa(
  id: number,
  feita: boolean | null,
  motivo?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_parada_avulsa_concluir', {
    p_id: id,
    p_feita: feita,
    p_motivo: motivo?.trim() || null,
  })
  if (error) throw new Error(error.message)
}

/** Tira a parada da rota (nada se apaga — fica registrada como removida). */
export async function removerParadaAvulsa(id: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_parada_avulsa_remover', { p_id: id })
  if (error) throw new Error(error.message)
}

/** As paradas de um período (só a logística; até dois meses por vez). */
export async function listarParadasAvulsas(parametros: {
  de: string
  ate: string
}): Promise<ParadaAvulsa[]> {
  const { data, error } = await supabase.rpc('plt_fn_paradas_avulsas', {
    p_de: parametros.de,
    p_ate: parametros.ate,
  })
  if (error) throw new Error(`Não deu para carregar as paradas avulsas: ${error.message}`)
  return (data ?? []) as ParadaAvulsa[]
}

/**
 * A aba Programar com parada avulsa: programa os pedidos (como
 * `programarRota`), põe as paradas novas e salva a ordem da tela, numa
 * transação. O que a rota já tinha vai DEPOIS da ordem da tela. Devolve o id
 * de cada parada nova pela chave da tela.
 */
export async function programarRotaComParadas(parametros: {
  data: string
  caminhaoId: number
  rota: number
  cardIds: number[]
  paradas: (DadosParadaAvulsa & { chave: string })[]
  ordem: ItemDaMontagem[] | null
}): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('plt_fn_programar_rota_paradas', {
    p_data: parametros.data,
    p_caminhao_id: parametros.caminhaoId,
    p_rota: parametros.rota,
    p_card_ids: parametros.cardIds,
    p_paradas: parametros.paradas.map((p) => ({
      k: p.chave,
      titulo: p.titulo.trim(),
      endereco: p.endereco.trim(),
      latitude: p.latitude,
      longitude: p.longitude,
      observacao: p.observacao?.trim() || null,
    })),
    p_ordem: parametros.ordem,
  })
  if (error) throw new Error(`Não deu para programar: ${error.message}`)
  const mapa = (data as { paradas?: Record<string, number | string> } | null)?.paradas ?? {}
  return Object.fromEntries(Object.entries(mapa).map(([k, id]) => [k, Number(id)]))
}

/**
 * A chave do cache do mapa para o endereço DIGITADO da parada avulsa:
 * 'avulsa:' + sha256 do endereço normalizado (sem espaço nas pontas, em
 * minúsculas) — separada da chave dos pedidos (md5 calculado no banco).
 */
export async function chaveGeoDaParada(endereco: string): Promise<string> {
  const normalizado = endereco.trim().toLowerCase()
  const bytes = new TextEncoder().encode(normalizado)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hash = await crypto.subtle.digest('SHA-256', bytes)
    const hex = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
    return `avulsa:${hex}`
  }
  // navegador sem a criptografia da página (fora do https): um resumo simples, estável
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (const b of bytes) {
    h1 = Math.imul(h1 ^ b, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ b, 0x811c9dc5) >>> 0
  }
  return `avulsa:${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`
}

/** O ponto de um endereço digitado (pela mesma função `geocodificar` — e o mesmo cache). */
export async function acharPontoDoEndereco(
  endereco: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const texto = endereco.trim()
  if (texto.length < 3) return null
  const chave = await chaveGeoDaParada(texto)
  const [resultado] = await geocodificar([{ chave, endereco: texto }])
  if (!resultado?.resolvido || resultado.latitude === null || resultado.longitude === null)
    return null
  return { latitude: resultado.latitude, longitude: resultado.longitude }
}

/** Uma chave nova por gesto (o toque repetido não dobra a parada). */
export function chaveDoGesto(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // navegador antigo do tablet: um uuid v4 do mesmo jeito
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
