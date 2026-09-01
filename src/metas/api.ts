import { supabase } from '@/lib/supabase'
import { COLUNAS_CARD } from '@/kanban/tipos'
import type { Card, ExecucaoAberta } from '@/kanban/tipos'

/**
 * Camada de dados do Meu Painel e do cockpit de metas (SESSAO-14 / D-37).
 * O progresso NUNCA é digitado: a porta plt_fn_metas_painel calcula tudo no
 * banco, dos eventos que já existem — o front só mostra. Quem pode criar/
 * editar/encerrar é decisão de RLS; a tela apenas reflete.
 */

export type IndicadorMeta = 'unidades' | 'tarefas' | 'tempo_util'
export type PeriodoMeta = 'diaria' | 'semanal' | 'mensal'

export interface MetaPainel {
  meta_id: number
  titulo: string | null
  indicador: IndicadorMeta
  periodo: PeriodoMeta
  alvo: number
  usuario_id: string | null
  usuario_nome: string | null
  setor_id: number | null
  setor_nome: string | null
  criada_por_nome: string | null
  encerrada_em: string | null
  janela_inicio: string
  janela_fim: string
  progresso: number
  contagem_total: number
}

function garantir<T>(dados: T | null, erro: { message: string } | null, contexto: string): T {
  if (erro) throw new Error(`${contexto}: ${erro.message}`)
  if (dados === null) throw new Error(`${contexto}: o servidor não devolveu dados.`)
  return dados
}

export async function buscarMetasPainel(parametros?: {
  incluirEncerradas?: boolean
  limite?: number
  deslocamento?: number
}): Promise<MetaPainel[]> {
  const { data, error } = await supabase.rpc('plt_fn_metas_painel', {
    p_incluir_encerradas: parametros?.incluirEncerradas ?? false,
    p_limite: parametros?.limite ?? 20,
    p_deslocamento: parametros?.deslocamento ?? 0,
  })
  const linhas = garantir(data as MetaPainel[] | null, error, 'Não deu para carregar as metas')
  // numeric chega como string pelo PostgREST — normaliza uma vez, aqui.
  return linhas.map((m) => ({ ...m, alvo: Number(m.alvo), progresso: Number(m.progresso) }))
}

export async function criarMeta(parametros: {
  titulo?: string
  indicador: IndicadorMeta
  periodo: PeriodoMeta
  alvo: number
  /** O dono é UMA pessoa OU UM setor — exatamente um dos dois. */
  usuarioId?: string | null
  setorId?: number | null
  criadaPor: string
}): Promise<void> {
  const { error } = await supabase.from('plt_metas').insert({
    titulo: parametros.titulo?.trim() || null,
    indicador: parametros.indicador,
    periodo: parametros.periodo,
    alvo: parametros.alvo,
    usuario_id: parametros.usuarioId ?? null,
    setor_id: parametros.setorId ?? null,
    criada_por_id: parametros.criadaPor,
  })
  if (error) throw new Error(`Não deu para criar a meta: ${error.message}`)
}

export async function atualizarMeta(
  id: number,
  mudancas: { titulo?: string | null; indicador?: IndicadorMeta; periodo?: PeriodoMeta; alvo?: number },
): Promise<void> {
  const { error } = await supabase
    .from('plt_metas')
    .update({
      ...(mudancas.titulo !== undefined ? { titulo: mudancas.titulo?.trim() || null } : {}),
      ...(mudancas.indicador ? { indicador: mudancas.indicador } : {}),
      ...(mudancas.periodo ? { periodo: mudancas.periodo } : {}),
      ...(mudancas.alvo !== undefined ? { alvo: mudancas.alvo } : {}),
    })
    .eq('id', id)
  if (error) throw new Error(`Não deu para salvar a meta: ${error.message}`)
}

/** Encerrar é definitivo (a história fica): para medir de novo, cria-se outra. */
export async function encerrarMeta(id: number): Promise<void> {
  const { error } = await supabase
    .from('plt_metas')
    .update({ encerrada_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`Não deu para encerrar a meta: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Pendências do painel — cada bloco vem do dado que já existe (nada novo é
// gravado): cards dos meus setores (qualidade a atestar), execuções abertas
// minhas, delegações e tarefas vêm de @/afazeres/api.
// ---------------------------------------------------------------------------

/** Cards vivos nos setores informados — insumo do bloco de qualidade a atestar. */
export async function cardsDosSetores(setorIds: number[]): Promise<Card[]> {
  if (setorIds.length === 0) return []
  const { data, error } = await supabase
    .from('plt_cards')
    .select(COLUNAS_CARD)
    .in('setor_atual_id', setorIds)
    .eq('tipo', 'unidade')
    .is('concluido_em', null)
    .is('arquivado_em', null)
    .order('desde', { ascending: true })
  if (error) throw new Error(`Não deu para carregar os cards dos seus setores: ${error.message}`)
  return (data ?? []) as unknown as Card[]
}

/** Pessoas ativas (id + nome) — opções de dono de meta para o admin. */
export async function usuariosAtivos(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await supabase
    .from('plt_usuarios')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome')
  if (error) throw new Error(`Não deu para carregar as pessoas: ${error.message}`)
  return (data ?? []) as { id: string; nome: string }[]
}

/** As execuções em andamento DESTA pessoa — "o que estou fazendo agora". */
export async function minhasExecucoesAbertas(usuarioId: string): Promise<ExecucaoAberta[]> {
  const { data, error } = await supabase
    .from('plt_vw_execucoes')
    .select('evento_inicio_id, card_id, usuario_inicio_id, iniciou_em')
    .eq('usuario_inicio_id', usuarioId)
    .eq('em_andamento', true)
    .order('iniciou_em', { ascending: true })
  if (error) throw new Error(`Não deu para carregar suas execuções: ${error.message}`)
  return (data ?? []) as ExecucaoAberta[]
}
