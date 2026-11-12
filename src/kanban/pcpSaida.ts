import { supabase } from '@/lib/supabase'
import type { LugarDasPecas, PecasQueSeguem } from './api'

/*
 * SESSAO-50 (bloco B): o pedido que sai do PCP sem ser produzido — "Cancelar
 * pedido" (cancela também no Tiny, pela fila de saída) e "Ocultar do PCP" (o
 * Tiny não muda; fica em "Pedidos ocultos" por N dias) —, as duas abas que
 * substituem a "Cancelados e removidos" da SESSAO-48, e o "Incluir pedido no
 * PCP" que também traz o oculto de qualquer idade. As portas conferem quem pode
 * (PCP, logística e admin) e são idempotentes: tocar duas vezes = um efeito.
 */

/** Uma peça viva do pedido e o que acontece com ela ao ocultar. */
export interface LugarAoOcultar extends LugarDasPecas {
  /** Fica onde está ao ocultar (já na rota, entregue, ou pronta de pedido programado). */
  fica: boolean
}

export interface PecasAoOcultar {
  /** Quantas sairiam junto com "Ocultar o pedido e as peças". */
  ocultaveis: number
  /** Quantas ficam de qualquer jeito (na rota, entregues…). */
  ficam: number
  programado: boolean
  onde: LugarAoOcultar[]
}

/** Em que pé está o pedido de cancelamento no Tiny (a fila de saída). */
export type EstadoCancelamentoTiny = 'confirmado' | 'aceito' | 'esperando' | 'falhando' | 'parado'

/** O que os modais "Cancelar pedido" e "Ocultar do PCP" mostram — uma requisição ao abrir. */
export interface SaidaPrevia {
  card_id: number
  pedido_id: number
  numero: number
  cliente: string | null
  situacao: string | null
  cancelado_no_tiny: boolean
  /** A ida ao Tiny ligada (Configurações → Caminhões): sem ela não dá para cancelar daqui. */
  tiny_ligado: boolean
  cancelado_plataforma_em: string | null
  tiny_estado: EstadoCancelamentoTiny | null
  oculto_em: string | null
  entregue: boolean
  arquivado: boolean
  /** Quantos dias o oculto fica na lista "Pedidos ocultos". */
  ocultos_dias: number
  pecas: PecasQueSeguem
  ocultar: PecasAoOcultar
  /** Peças do estoque reservadas para o pedido (soltam ao cancelar ou ao ocultar com as peças). */
  reservas: number
}

export async function lerSaidaPrevia(cardId: number): Promise<SaidaPrevia> {
  const { data, error } = await supabase.rpc('plt_fn_pcp_saida_previa', { p_card_id: cardId })
  if (error) throw new Error(error.message)
  return data as SaidaPrevia
}

export interface ResultadoCancelar {
  feito: boolean
  numero: number | null
  /** 'ja_cancelado' / 'ja_cancelado_no_tiny' / 'tentar_de_novo' — quando não houve cancelamento novo. */
  motivo?: string
  tiny_estado?: EstadoCancelamentoTiny
  /** O que a fila de saída respondeu ('chamado', 'pausado'…). */
  tiny?: string
  reservas_soltas?: number
  em_producao?: number
  prontas?: number
}

/**
 * "Cancelar pedido": o pedido sai do PCP na hora e o cancelamento vai ao Tiny
 * pela fila de saída. Com o pedido já cancelado e o Tiny parado ou falhando, é
 * o "Tentar de novo".
 */
export async function cancelarPedido(cardId: number, chave: string): Promise<ResultadoCancelar> {
  const { data, error } = await supabase.rpc('plt_fn_pcp_cancelar', { p_card_id: cardId, p_chave: chave })
  if (error) throw new Error(error.message)
  return data as ResultadoCancelar
}

export interface ResultadoOcultar {
  feito: boolean
  numero: number | null
  motivo?: string
  ocultadas?: number
  reservas_soltas?: number
  dias?: number
  /** As peças que ficaram com o pedido (na rota, entregues… ou todas, no "Ocultar só o pedido"). */
  ficam?: PecasAoOcultar
}

/** "Ocultar do PCP": só o pedido, ou o pedido e as peças já liberadas. */
export async function ocultarPedido(parametros: {
  cardId: number
  comPecas: boolean
  chave: string
}): Promise<ResultadoOcultar> {
  const { data, error } = await supabase.rpc('plt_fn_pcp_ocultar', {
    p_card_id: parametros.cardId,
    p_com_pecas: parametros.comPecas,
    p_chave: parametros.chave,
  })
  if (error) throw new Error(error.message)
  return data as ResultadoOcultar
}

export interface ResultadoRecuperar {
  feito: boolean
  numero: number | null
  /** O Tiny o mantém fora do PCP (cancelado, faturado…) — sai dos ocultos, mas não volta ao quadro. */
  fora_pelo_tiny?: boolean
  situacao?: string | null
  standby?: boolean
  /** Quantos produtos voltam para liberar (as vagas abertas). */
  a_liberar?: number
}

/** "Recuperar": o pedido volta ao PCP com as vagas abertas — nenhuma peça volta para coluna. */
export async function recuperarPedido(cardId: number): Promise<ResultadoRecuperar> {
  const { data, error } = await supabase.rpc('plt_fn_pcp_devolver', { p_card_id: cardId })
  if (error) throw new Error(error.message)
  return data as ResultadoRecuperar
}

/** O cursor das duas abas: quando saiu do PCP e o card da última linha mostrada. */
export interface CursorSaida {
  em: string
  cardId: number
}

export const SAIDAS_POR_PAGINA = 20

/** Por que o pedido está em "Cancelados". */
export type MotivoCancelado = 'tiny' | 'plataforma' | 'excluido'

/** Uma linha da aba "Cancelados". */
export interface PedidoCancelado {
  card_id: number
  pedido_id: number
  numero: number
  cliente_nome: string
  data_pedido: string | null
  situacao: string | null
  motivo: MotivoCancelado
  /** Quando saiu do PCP — a ordem e o cursor (o texto do banco, sem mexer). */
  saiu_em: string
  cancelado_por: string | null
  tiny_estado: EstadoCancelamentoTiny | null
  tiny_erro: string | null
  total_unidades: number
  em_producao: number
  prontas: number
  no_estoque: number
  esperando_decisao: number
  tem_mais: boolean
}

export interface PaginaSaida<T> {
  linhas: T[]
  proxima: CursorSaida | null
}

/** A aba "Cancelados" do PCP: o do Tiny, o cancelado pela plataforma e o excluído no Tiny. */
export async function listarCancelados(parametros: {
  busca?: string | null
  depois?: CursorSaida | null
}): Promise<PaginaSaida<PedidoCancelado>> {
  const { data, error } = await supabase.rpc('plt_fn_pcp_cancelados', {
    p_busca: parametros.busca?.trim() || null,
    p_limite: SAIDAS_POR_PAGINA,
    p_depois_em: parametros.depois?.em ?? null,
    p_depois_id: parametros.depois?.cardId ?? null,
  })
  if (error) throw new Error(`Não deu para carregar os cancelados: ${error.message}`)
  const linhas = (data ?? []) as PedidoCancelado[]
  const ultima = linhas.at(-1)
  return {
    linhas,
    proxima: ultima && linhas[0].tem_mais ? { em: ultima.saiu_em, cardId: ultima.card_id } : null,
  }
}

/** Uma linha da aba "Pedidos ocultos" (e da lista do "Incluir pedido no PCP"). */
export interface PedidoOculto {
  card_id: number
  pedido_id: number
  numero: number
  cliente_nome: string
  data_pedido: string | null
  situacao: string | null
  oculto_em: string
  oculto_por: string | null
  /** 'oculto' (ou um motivo antigo do "Remover do PCP"). */
  motivo: string | null
  texto: string | null
  pecas_ocultadas: number
  /** Quantos produtos voltam para liberar ao recuperar. */
  a_liberar: number
  /** O Tiny o mantém fora do PCP mesmo recuperado (cancelado, faturado…). */
  fora_pelo_tiny: boolean
  dias: number
  tem_mais: boolean
}

/** A aba "Pedidos ocultos": os ocultados dos últimos N dias (e o N, para a aba vazia dizer o prazo). */
export async function listarOcultos(parametros: {
  busca?: string | null
  depois?: CursorSaida | null
}): Promise<PaginaSaida<PedidoOculto> & { dias: number }> {
  const { data, error } = await supabase.rpc('plt_fn_pcp_ocultos', {
    p_busca: parametros.busca?.trim() || null,
    p_limite: SAIDAS_POR_PAGINA,
    p_depois_em: parametros.depois?.em ?? null,
    p_depois_id: parametros.depois?.cardId ?? null,
  })
  if (error) throw new Error(`Não deu para carregar os pedidos ocultos: ${error.message}`)
  const resposta = (data ?? { dias: 30, linhas: [] }) as { dias: number; linhas: PedidoOculto[] }
  const linhas = resposta.linhas ?? []
  const ultima = linhas.at(-1)
  return {
    dias: resposta.dias,
    linhas,
    proxima: ultima && linhas[0].tem_mais ? { em: ultima.oculto_em, cardId: ultima.card_id } : null,
  }
}

/** Admin: quantos dias o pedido oculto fica na lista (1 a 365). */
export async function mudarDiasOcultos(dias: number): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_pcp_ocultos_dias', { p_dias: dias })
  if (error) throw new Error(error.message)
  return data as number
}

/** Um pedido sem card (o "Incluir pedido no PCP" de sempre — só os que o PCP mostraria). */
export interface PedidoSemCard {
  pedido_id: number
  numero: number
  cliente_nome: string
  data_pedido: string | null
  situacao: string | null
  total_itens: number
  total_unidades: number
}

export interface ListaIncluir {
  /** Os ocultos de qualquer idade que batem com a busca (até 5; só na 1ª página). */
  ocultos: Omit<PedidoOculto, 'tem_mais' | 'dias'>[]
  sem_card: PedidoSemCard[]
  /** O cursor da página seguinte (o número da última linha); null = acabou. */
  proximo: number | null
}

/**
 * "Incluir pedido no PCP": os ocultos e uma página dos pedidos sem card numa
 * requisição — paginada no servidor pelo número (Lei §6: cursor, sem total).
 */
export async function listarParaIncluir(parametros: {
  busca?: string | null
  limite: number
  antesNumero: number | null
}): Promise<ListaIncluir> {
  const { data, error } = await supabase.rpc('plt_fn_pcp_incluir_lista', {
    p_busca: parametros.busca?.trim() || null,
    p_limite: parametros.limite,
    p_antes_numero: parametros.antesNumero,
  })
  if (error) throw new Error(`Não deu para carregar os pedidos: ${error.message}`)
  return data as ListaIncluir
}

/** Uma chave por gesto (o toque repetido vira um efeito só no banco). */
export function novaChave(prefixo: string): string {
  const aleatorio =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefixo}:${aleatorio}`
}

/** Quantos dias faltam para o pedido sair da lista "Pedidos ocultos" (dias de calendário, para cima). */
export function diasParaSair(ocultoEm: string, dias: number, agora = Date.now()): number {
  const limite = new Date(ocultoEm).getTime() + dias * 86_400_000
  return Math.max(0, Math.ceil((limite - agora) / 86_400_000))
}

/** O laço liberar → cancelar: a partir de quantas peças canceladas em 24 h o aviso muda (provisória da demanda). */
export const LACO_PECAS_24H = 3

/** "1 produto" / "7 produtos". */
export function produtosPorExtenso(n: number): string {
  return n === 1 ? '1 produto' : `${n} produtos`
}

/** "Este pedido tem 2 peças já liberadas (1 em A LIMPAR, 1 em PEDIDOS EM AGUARDO)." */
export function frasePecasLiberadas(o: PecasAoOcultar): string | null {
  const saem = o.onde.filter((l) => !l.fica)
  if (o.ocultaveis === 0) return null
  const lugares = saem.map((l) => `${l.pecas} em ${l.etapa ?? l.setor ?? 'outro lugar'}`).join(', ')
  return `Este pedido tem ${o.ocultaveis === 1 ? '1 peça já liberada' : `${o.ocultaveis} peças já liberadas`} (${lugares}). Ocultar também ${o.ocultaveis === 1 ? 'essa peça' : 'essas peças'}?`
}

/** "1 peça fica: já está na rota." — as que não saem nem com "o pedido e as peças". */
export function fraseQueFicam(o: PecasAoOcultar): string | null {
  const ficam = o.onde.filter((l) => l.fica)
  if (o.ficam === 0) return null
  const lugares = ficam.map((l) => `${l.pecas} em ${l.etapa ?? l.setor ?? 'outro lugar'}`).join(', ')
  return `${o.ficam === 1 ? '1 peça fica' : `${o.ficam} peças ficam`} com o pedido de qualquer jeito (${lugares}) — ${o.programado ? 'o pedido já está programado numa rota' : 'já saiu para a rota ou foi entregue'}.`
}

/** O aviso do pedido cancelado pela plataforma enquanto o Tiny não confirma. */
export function textoEstadoTiny(estado: EstadoCancelamentoTiny | null): string | null {
  switch (estado) {
    case 'esperando':
      return 'O Tiny ainda não confirmou o cancelamento — o pedido foi enviado agora há pouco.'
    case 'falhando':
      return 'O Tiny ainda não confirmou o cancelamento — ele recusou e a plataforma está tentando de novo.'
    case 'parado':
      return 'O Tiny ainda não confirmou o cancelamento — a plataforma parou de tentar.'
    case 'aceito':
      return 'O Tiny aceitou o cancelamento — falta a confirmação chegar.'
    default:
      return null
  }
}
