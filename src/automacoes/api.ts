import { supabase } from '@/lib/supabase'
import type { Gatilho } from './catalogo'
import type { DesenhoGuardado, Passo } from './desenho'

/**
 * As portas das automações (SESSAO-27 · D-103) — todas com o gate do SUPER
 * ADMIN dentro do banco (a tela só esconde). Listas paginadas no servidor,
 * com o total na mesma consulta (regra 17).
 */

export const POR_PAGINA_AUTOMACOES = 30
export const POR_PAGINA_EXECUCOES = 15

export interface AutomacaoResumo {
  id: number
  nome: string
  ligada: boolean
  gatilho: Gatilho
  gatilho_config: Record<string, unknown>
  passos_total: number
  ligada_em: string | null
  atualizada_em: string
  arquivada_em: string | null
  ultima_execucao_em: string | null
  ultima_situacao: string | null
  execucoes_24h: number
}

export interface Automacao {
  id: number
  nome: string
  ligada: boolean
  gatilho: Gatilho
  gatilho_config: Record<string, unknown>
  passos: Passo[]
  desenho: unknown
  segredo: string
  ligada_em: string | null
  arquivada_em: string | null
  criada_em: string
  atualizada_em: string
}

export interface ResultadoPasso {
  n: number
  tipo: string
  resultado: string
  frase: string
  em: string
  arquivou?: boolean
}

export interface Execucao {
  id: number
  gatilho: Gatilho
  situacao: string
  avaliacao: string | null
  resultado: ResultadoPasso[]
  profundidade: number
  card_id: number | null
  card_tipo: 'pedido' | 'unidade' | 'reposicao' | null
  card_arquivado: boolean | null
  produto: string | null
  unidade: string | null
  pedido_numero: number | null
  setor: string | null
  etapa: string | null
  contexto: Record<string, unknown>
  executar_em: string | null
  criada_em: string
  atualizada_em: string
}

export async function listarAutomacoes(
  pagina: number,
  arquivadas = false,
): Promise<{ linhas: AutomacaoResumo[]; total: number }> {
  const { data, error } = await supabase.rpc('plt_fn_automacoes', {
    p_limite: POR_PAGINA_AUTOMACOES,
    p_deslocamento: (pagina - 1) * POR_PAGINA_AUTOMACOES,
    p_arquivadas: arquivadas,
  })
  if (error) throw new Error(`Não deu para carregar as automações: ${error.message}`)
  const linhas = (data ?? []) as (AutomacaoResumo & { contagem_total: number })[]
  return { linhas, total: Number(linhas[0]?.contagem_total ?? 0) }
}

export async function buscarAutomacao(id: number): Promise<Automacao> {
  const { data, error } = await supabase.rpc('plt_fn_automacao', { p_id: id })
  if (error) throw new Error(`Não deu para abrir a automação: ${error.message}`)
  return data as Automacao
}

export async function salvarAutomacao(parametros: {
  id: number | null
  nome: string
  gatilho: Gatilho
  gatilhoConfig: Record<string, unknown>
  passos: Passo[]
  desenho: DesenhoGuardado
}): Promise<number> {
  const { data, error } = await supabase.rpc('plt_fn_automacao_salvar', {
    p_id: parametros.id,
    p_nome: parametros.nome,
    p_gatilho: parametros.gatilho,
    p_gatilho_config: parametros.gatilhoConfig,
    p_passos: parametros.passos,
    p_desenho: parametros.desenho,
  })
  if (error) throw new Error(error.message)
  return data as number
}

export async function ligarAutomacao(id: number, ligar: boolean): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_automacao_ligar', { p_id: id, p_ligar: ligar })
  if (error) throw new Error(error.message)
}

export async function arquivarAutomacao(id: number, arquivar: boolean): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_automacao_arquivar', { p_id: id, p_arquivar: arquivar })
  if (error) throw new Error(error.message)
}

export async function listarExecucoes(
  automacaoId: number,
  pagina: number,
): Promise<{ linhas: Execucao[]; total: number }> {
  const { data, error } = await supabase.rpc('plt_fn_automacao_execucoes', {
    p_automacao_id: automacaoId,
    p_limite: POR_PAGINA_EXECUCOES,
    p_deslocamento: (pagina - 1) * POR_PAGINA_EXECUCOES,
  })
  if (error) throw new Error(`Não deu para carregar as execuções: ${error.message}`)
  const linhas = (data ?? []) as (Execucao & { contagem_total: number })[]
  return { linhas, total: Number(linhas[0]?.contagem_total ?? 0) }
}

/** O endereço da chamada de fora desta automação (a Edge Function `api`). */
export function enderecoChamada(automacaoId: number): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '') ?? ''
  return `${base}/functions/v1/api/automacoes/${automacaoId}/disparar`
}
