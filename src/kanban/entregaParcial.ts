import { supabase } from '@/lib/supabase'
import { pecasPorExtenso } from './avisoPcp'
import { produtosPorExtenso } from './pcpSaida'

/**
 * SESSAO-51 (bloco A · frente 3): a entrega PARCIAL e a decisão sobre o que
 * estava na fábrica — "Deixar em produção" ou "Limpar da produção" — que se
 * revoga quantas vezes for preciso (a aba "Entregas parciais" do PCP e a ficha
 * do pedido). Cada lista e cada janela numa requisição, só no clique (Lei §3).
 */

export type DecisaoParcial = 'manter' | 'limpar'

export interface PecaNaFabrica {
  id: number
  descricao: string | null
  indice: number | null
  total: number | null
  setor: string | null
  etapa: string | null
  trabalhando?: boolean
}

export interface PecaPronta {
  id: number
  descricao: string | null
  indice: number | null
  total: number | null
  onde: string | null
  na_rota: boolean
}

export interface PecaRetirada {
  id: number
  descricao: string | null
  indice: number | null
  total: number | null
  setor: string | null
  etapa: string | null
  destino_setor: string | null
  destino_etapa: string | null
  mudou_etapa: boolean
  vira_vaga: boolean
}

/** O estado da entrega parcial de um pedido (a ficha, a lista e a janela do revogar). */
export interface EstadoParcial {
  card_id: number
  pedido_id: number
  numero: number
  cliente: string
  parcial_em: string
  parcial_por: string | null
  entregues: number | null
  total: number | null
  decisao: DecisaoParcial | null
  decisao_em: string | null
  decisao_por: string | null
  na_producao?: PecaNaFabrica[]
  prontas?: PecaPronta[]
  retiradas?: PecaRetirada[]
  n_producao: number
  n_prontas: number
  n_retiradas: number
  vagas: number
  fechado: boolean
  acao: 'remover' | 'voltar' | null
  pode_revogar: boolean
  porque_nao: string | null
  /** Só na lista: o cursor. */
  cursor_em?: string
}

export interface PaginaParciais {
  itens: EstadoParcial[]
  proxima: { em: string; id: number } | null
}

/** A aba "Entregas parciais": por cursor, do mais recente para trás; só o que ainda dá para revogar. */
export async function listarEntregasParciais(parametros: {
  busca?: string | null
  depois?: { em: string; id: number } | null
  limite?: number
}): Promise<PaginaParciais> {
  const limite = parametros.limite ?? 20
  const { data, error } = await supabase.rpc('plt_fn_entregas_parciais', {
    p_busca: parametros.busca?.trim() || null,
    p_limite: limite,
    p_depois_em: parametros.depois?.em ?? null,
    p_depois_id: parametros.depois?.id ?? null,
  })
  if (error) throw new Error(`Não deu para carregar as entregas parciais: ${error.message}`)
  const d = (data ?? {}) as { itens?: EstadoParcial[]; tem_mais?: boolean }
  const itens = d.itens ?? []
  const ultima = itens[itens.length - 1]
  return {
    itens,
    proxima: d.tem_mais && ultima?.cursor_em ? { em: ultima.cursor_em, id: ultima.card_id } : null,
  }
}

/** A janela do revogar — lida ao abrir (as peças e para onde cada uma vai). */
export async function previaEntregaParcial(cardId: number): Promise<EstadoParcial> {
  const { data, error } = await supabase.rpc('plt_fn_entrega_parcial_previa', { p_card_id: cardId })
  if (error) throw new Error(error.message)
  return data as EstadoParcial
}

export interface ResultadoRevogar {
  feito: boolean
  repetido?: boolean
  decisao: DecisaoParcial
  retiradas?: number
  voltaram?: number
  viraram_vaga?: number
  vagas?: number
  ficaram?: number
  fechou?: boolean
  reabriu?: boolean
}

/** O revogar: um toque, uma chamada idempotente (a chave do toque). */
export async function revogarEntregaParcial(
  cardId: number,
  chave: string,
): Promise<ResultadoRevogar> {
  const { data, error } = await supabase.rpc('plt_fn_entrega_parcial_revogar', {
    p_card_id: cardId,
    p_chave: chave,
  })
  if (error) throw new Error(error.message)
  return data as ResultadoRevogar
}

/** "Seguem em produção: 2 peças · 1 produto no PCP" / "Retiradas da produção: 2 peças · 1 produto do PCP". */
export function textoDecisao(
  e: Pick<EstadoParcial, 'decisao' | 'n_producao' | 'n_retiradas' | 'vagas'>,
): string {
  if (e.decisao === 'manter') {
    const partes = [
      e.n_producao > 0 ? pecasPorExtenso(e.n_producao) : '',
      e.vagas > 0 ? `${produtosPorExtenso(e.vagas)} no PCP` : '',
    ].filter(Boolean)
    return `Seguem em produção: ${partes.join(' · ') || 'nada'}`
  }
  if (e.decisao === 'limpar') {
    const partes = [
      e.n_retiradas > 0 ? pecasPorExtenso(e.n_retiradas) : '',
      e.vagas > 0 ? `${produtosPorExtenso(e.vagas)} do PCP` : '',
    ].filter(Boolean)
    return `Retiradas da produção: ${partes.join(' · ') || 'nada'}`
  }
  return 'Sem decisão sobre a fábrica'
}

/** O botão contrário à decisão que vale. */
export function textoBotaoRevogar(acao: EstadoParcial['acao']): string {
  return acao === 'remover'
    ? 'Revogar e remover da linha de produção'
    : 'Revogar e voltar tudo para a produção'
}

/** "Entregue em parte (2 de 5)". */
export function textoEntregueEmParte(
  entregues: number | null | undefined,
  total: number | null | undefined,
): string {
  if (!entregues || !total) return 'Entregue em parte'
  return `Entregue em parte (${entregues} de ${total})`
}

/** "As 2 peças seguem onde estão e o produto segue no PCP para liberar…" (a janela da entrega parcial). */
export function textoManter(pecas: number, vagas: number): string {
  const p =
    pecas === 0
      ? ''
      : pecas === 1
        ? 'A peça segue onde está'
        : `As ${pecas} peças seguem onde estão`
  const v =
    vagas === 0
      ? ''
      : vagas === 1
        ? 'o produto segue no PCP para liberar'
        : `os ${vagas} produtos seguem no PCP para liberar`
  const frase = [p, v].filter(Boolean).join(' e ')
  return `${frase.charAt(0).toUpperCase()}${frase.slice(1)}. Quando ficarem prontos, o pedido volta para ser programado.`
}

/** "As 2 peças saem dos quadros e o produto sai do PCP. Dá para voltar atrás…" */
export function textoLimpar(pecas: number, vagas: number): string {
  const p =
    pecas === 0 ? '' : pecas === 1 ? 'A peça sai dos quadros' : `As ${pecas} peças saem dos quadros`
  const v =
    vagas === 0 ? '' : vagas === 1 ? 'o produto sai do PCP' : `os ${vagas} produtos saem do PCP`
  const frase = [p, v].filter(Boolean).join(' e ')
  return `${frase.charAt(0).toUpperCase()}${frase.slice(1)}. Dá para voltar atrás em PCP → Entregas parciais.`
}

/** "Guarda-roupa 3/4 (3/5)". */
export function nomeComIndice(p: {
  descricao: string | null
  indice: number | null
  total: number | null
}): string {
  return `${p.descricao ?? 'Peça'}${p.total && p.total > 1 ? ` (${p.indice}/${p.total})` : ''}`
}
