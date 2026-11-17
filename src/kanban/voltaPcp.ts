import { supabase } from '@/lib/supabase'

/**
 * SESSAO-51 (bloco B): "Mover para o PCP" — o administrador tira a peça da
 * produção e a devolve ao PCP como vaga do pedido (com motivo) ou como
 * reposição de estoque. A janela lê ao abrir (uma requisição); o gesto é um
 * toque, idempotente pela chave.
 */

export type EscolhaVolta = 'voltar' | 'reposicao'

export interface OpcaoVolta {
  pode: boolean
  porque_nao: string | null
}

export interface PreviaVoltaPcp {
  card_id: number
  descricao: string | null
  indice: number | null
  total: number | null
  pedido_id: number | null
  numero: number | null
  setor: string | null
  etapa: string | null
  /** Quem está trabalhando nela agora (o tempo dele fecha). */
  executor: string | null
  pausado: boolean
  pode: boolean
  porque_nao: string | null
  voltar: OpcaoVolta
  reposicao: OpcaoVolta
  motivos: { id: number; texto: string }[]
}

export async function previaVoltarPcp(cardId: number): Promise<PreviaVoltaPcp> {
  const { data, error } = await supabase.rpc('plt_fn_card_voltar_pcp_previa', { p_card_id: cardId })
  if (error) throw new Error(error.message)
  return data as PreviaVoltaPcp
}

export interface ResultadoVoltaPcp {
  feito: boolean
  repetido?: boolean
  escolha?: EscolhaVolta
  numero?: number | null
  reposicao_card_id?: number | null
  reposicao_nova?: boolean
}

export async function voltarParaPcp(parametros: {
  cardId: number
  escolha: EscolhaVolta
  motivoId: number | null
  observacao: string
  chave: string
}): Promise<ResultadoVoltaPcp> {
  const { data, error } = await supabase.rpc('plt_fn_card_voltar_pcp', {
    p_card_id: parametros.cardId,
    p_escolha: parametros.escolha,
    p_motivo_id: parametros.motivoId,
    p_observacao: parametros.observacao.trim() || null,
    p_chave: parametros.chave,
  })
  if (error) throw new Error(error.message)
  return data as ResultadoVoltaPcp
}

/**
 * Quem vê o botão (o banco confere de novo): o administrador, fora do tablet,
 * numa peça viva em setor de produção — nunca card avulso, de ajuste, peça
 * cancelada ou esperando o destino de um pedido cancelado.
 */
export function mostraVoltarPcp(parametros: {
  tipo: string
  vivo: boolean
  papelDoSetor: string | null | undefined
  tablet: boolean
  souAdmin: boolean
  cancelada: boolean
  ajuste: boolean
  destinoPendente: boolean
}): boolean {
  return (
    parametros.souAdmin &&
    !parametros.tablet &&
    parametros.tipo === 'unidade' &&
    parametros.vivo &&
    parametros.papelDoSetor === 'producao' &&
    !parametros.cancelada &&
    !parametros.ajuste &&
    !parametros.destinoPendente
  )
}

/** "1 voltou da produção: Prioridade mudou — estava em MONTAGEM · Montando". */
export function textoSeloVolta(v: {
  voltar: number
  reposicao: number
  ultimo?: {
    escolha?: string | null
    motivo?: string | null
    observacao?: string | null
    setor?: string | null
    etapa?: string | null
  } | null
}): string {
  const partes: string[] = []
  if (v.voltar > 0) partes.push(`${v.voltar} voltou da produção`)
  if (v.reposicao > 0) partes.push(`${v.reposicao} virou reposição de estoque`)
  const u = v.ultimo
  const porque = u?.escolha === 'voltar' ? (u.motivo ?? u.observacao ?? null) : null
  const onde = [u?.setor, u?.etapa].filter(Boolean).join(' · ')
  return `${partes.join(' · ')}${porque ? `: ${porque}` : ''}${onde ? ` — estava em ${onde}` : ''}`
}
