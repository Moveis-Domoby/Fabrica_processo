import { supabase } from '@/lib/supabase'
import { COLUNAS_CARD } from '@/kanban/tipos'
import type { Card } from '@/kanban/tipos'

/**
 * Camada de dados dos afazeres (SESSAO-12 / D-34 / RF-40…43).
 * "Meus afazeres" = cards sob minha responsabilidade + tarefas avulsas minhas.
 * O RLS decide o que cada um enxerga; a delegação organiza, não trava.
 */

export interface Tarefa {
  id: number
  titulo: string
  descricao: string | null
  card_id: number | null
  setor_id: number | null
  responsavel_id: string | null
  criada_por_id: string | null
  delegacao: 'direta' | 'aleatoria'
  situacao: 'aberta' | 'em_andamento' | 'concluida'
  prazo: string | null
  iniciada_em: string | null
  concluida_em: string | null
  criada_em: string
  /** SESSAO-23: subtarefa = tarefa com mãe (mesma tabela, até 2 níveis). */
  tarefa_mae_id: number | null
  /** SESSAO-23: 'sistema' = pendência de parecer de qualidade (delegante "Sistema"). */
  origem: 'pessoa' | 'sistema'
  evento_referencia_id: number | null
  /** SESSAO-23: pessoal privada — só o dono vê; o RLS garante, aqui só reflete. */
  privada: boolean
}

const COLUNAS_TAREFA =
  'id, titulo, descricao, card_id, setor_id, responsavel_id, criada_por_id, ' +
  'delegacao, situacao, prazo, iniciada_em, concluida_em, criada_em, ' +
  'tarefa_mae_id, origem, evento_referencia_id, privada'

/** Tarefa criada por mim, para mim (é a que pode ser privada). */
export function ehTarefaPessoal(t: Tarefa): boolean {
  return t.origem === 'pessoa' && t.criada_por_id !== null && t.criada_por_id === t.responsavel_id
}

export async function meusCards(usuarioId: string): Promise<Card[]> {
  const { data, error } = await supabase
    .from('plt_cards')
    .select(COLUNAS_CARD)
    .eq('responsavel_id', usuarioId)
    .is('concluido_em', null)
    .is('arquivado_em', null)
    .order('desde', { ascending: true })
  if (error) throw new Error(`Não deu para carregar seus cards: ${error.message}`)
  return (data ?? []) as unknown as Card[]
}

export async function minhasTarefas(usuarioId: string): Promise<Tarefa[]> {
  const { data, error } = await supabase
    .from('plt_tarefas')
    .select(COLUNAS_TAREFA)
    .eq('responsavel_id', usuarioId)
    .neq('situacao', 'concluida')
    .is('tarefa_mae_id', null) // subtarefa aparece dentro da mãe, nunca solta
    .order('criada_em', { ascending: true })
  if (error) throw new Error(`Não deu para carregar suas tarefas: ${error.message}`)
  return (data ?? []) as unknown as Tarefa[]
}

/**
 * As tarefas do "Sistema" dos meus setores (SESSAO-23): pendências de parecer
 * de qualidade viradas tarefa — sem responsável, do setor recebedor inteiro.
 */
export async function tarefasDoSistema(setorIds: number[]): Promise<Tarefa[]> {
  if (setorIds.length === 0) return []
  const { data, error } = await supabase
    .from('plt_tarefas')
    .select(COLUNAS_TAREFA)
    .eq('origem', 'sistema')
    .in('setor_id', setorIds)
    .neq('situacao', 'concluida')
    .order('criada_em', { ascending: true })
  if (error) throw new Error(`Não deu para carregar as tarefas do sistema: ${error.message}`)
  return (data ?? []) as unknown as Tarefa[]
}

/** Subtarefas (todas, inclusive concluídas — o contador "2/5" precisa delas). */
export async function subtarefasDe(maeIds: number[]): Promise<Tarefa[]> {
  if (maeIds.length === 0) return []
  const { data, error } = await supabase
    .from('plt_tarefas')
    .select(COLUNAS_TAREFA)
    .in('tarefa_mae_id', maeIds)
    .order('criada_em', { ascending: true })
  if (error) throw new Error(`Não deu para carregar as subtarefas: ${error.message}`)
  return (data ?? []) as unknown as Tarefa[]
}

/** Subtarefa herda setor, responsável e privacidade da mãe (regra do banco). */
export async function criarSubtarefa(parametros: {
  maeId: number
  titulo: string
  criadaPor: string
}): Promise<void> {
  const { error } = await supabase.from('plt_tarefas').insert({
    titulo: parametros.titulo.trim(),
    tarefa_mae_id: parametros.maeId,
    criada_por_id: parametros.criadaPor,
    delegacao: 'direta',
  })
  if (error) throw new Error(`Não deu para criar a subtarefa: ${error.message}`)
}

/** Editar o texto da tarefa — direto no card (pedido do dono, 23/09). */
export async function editarTarefa(parametros: {
  id: number
  titulo: string
  descricao?: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('plt_tarefas')
    .update({
      titulo: parametros.titulo.trim(),
      descricao: parametros.descricao?.trim() || null,
    })
    .eq('id', parametros.id)
  if (error) throw new Error(`Não deu para salvar a tarefa: ${error.message}`)
}

/**
 * Parar o timer SEM concluir: a contagem é descartada (o timer da tarefa é
 * opcional — D-34; quem parou é porque não quer contar aquele tempo).
 */
export async function pararTempo(id: number): Promise<void> {
  const { error } = await supabase
    .from('plt_tarefas')
    .update({ iniciada_em: null, situacao: 'aberta' })
    .eq('id', id)
  if (error) throw new Error(`Não deu para parar o tempo: ${error.message}`)
}

export async function reabrirTarefa(id: number): Promise<void> {
  const { error } = await supabase
    .from('plt_tarefas')
    .update({ situacao: 'aberta', concluida_em: null })
    .eq('id', id)
  if (error) throw new Error(`Não deu para reabrir: ${error.message}`)
}

/** Tornar pública/privada — gesto do dono da tarefa pessoal (resposta 6). */
export async function definirPrivacidade(id: number, privada: boolean): Promise<void> {
  const { error } = await supabase.from('plt_tarefas').update({ privada }).eq('id', id)
  if (error) throw new Error(`Não deu para mudar a visibilidade: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Fila de prioridade (SESSAO-23): preferência de EXIBIÇÃO do usuário (M-04).
// Chave "t:{id}" = tarefa · "c:{id}" = card delegado. Reordenar não muda dado
// de tarefa nenhum — só a ordem guardada no cadastro do próprio usuário.
// ---------------------------------------------------------------------------
export async function buscarFilaPrioridade(usuarioId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('plt_usuarios')
    .select('fila_prioridade')
    .eq('id', usuarioId)
    .single()
  if (error) throw new Error(`Não deu para carregar a fila de prioridade: ${error.message}`)
  const fila = (data as { fila_prioridade: unknown } | null)?.fila_prioridade
  return Array.isArray(fila) ? fila.filter((c): c is string => typeof c === 'string') : []
}

export async function salvarFilaPrioridade(usuarioId: string, chaves: string[]): Promise<void> {
  const { error } = await supabase
    .from('plt_usuarios')
    .update({ fila_prioridade: chaves })
    .eq('id', usuarioId)
  if (error) throw new Error(`Não deu para guardar a ordem da fila: ${error.message}`)
}

/** Cards e tarefas abertas de um setor — a visão do líder (RF-40). */
export async function afazeresDoSetor(setorId: number): Promise<{
  cards: Card[]
  tarefas: Tarefa[]
}> {
  const [cards, tarefas] = await Promise.all([
    supabase
      .from('plt_cards')
      .select(COLUNAS_CARD)
      .eq('setor_atual_id', setorId)
      .eq('tipo', 'unidade')
      .is('concluido_em', null)
      .is('arquivado_em', null)
      .order('desde', { ascending: true }),
    supabase
      .from('plt_tarefas')
      .select(COLUNAS_TAREFA)
      .eq('setor_id', setorId)
      .neq('situacao', 'concluida')
      // A tarefa do Sistema se resolve no quadro (parecer), não na reatribuição;
      // subtarefa vive dentro da mãe.
      .eq('origem', 'pessoa')
      .is('tarefa_mae_id', null)
      .order('criada_em', { ascending: true }),
  ])
  if (cards.error) throw new Error(`Não deu para carregar os cards: ${cards.error.message}`)
  if (tarefas.error) throw new Error(`Não deu para carregar as tarefas: ${tarefas.error.message}`)
  return {
    cards: (cards.data ?? []) as unknown as Card[],
    tarefas: (tarefas.data ?? []) as unknown as Tarefa[],
  }
}

export async function criarTarefa(parametros: {
  titulo: string
  descricao?: string
  setorId?: number | null
  responsavelId?: string | null
  criadaPor: string
  /** SESSAO-23: só vale quando a tarefa é para mim mesmo (o banco confere). */
  privada?: boolean
}): Promise<void> {
  const { error } = await supabase.from('plt_tarefas').insert({
    titulo: parametros.titulo.trim(),
    descricao: parametros.descricao?.trim() || null,
    setor_id: parametros.setorId ?? null,
    responsavel_id: parametros.responsavelId ?? null,
    criada_por_id: parametros.criadaPor,
    delegacao: 'direta',
    privada: parametros.privada ?? false,
  })
  if (error) throw new Error(`Não deu para criar a tarefa: ${error.message}`)
}

/** O timer é OPCIONAL (D-34): só grava se a pessoa quiser contar o tempo. */
export async function iniciarTarefa(id: number): Promise<void> {
  const { error } = await supabase
    .from('plt_tarefas')
    .update({ situacao: 'em_andamento', iniciada_em: new Date().toISOString() })
    .eq('id', id)
    .is('iniciada_em', null)
  if (error) throw new Error(`Não deu para iniciar: ${error.message}`)
}

export async function concluirTarefa(id: number): Promise<void> {
  const { error } = await supabase
    .from('plt_tarefas')
    .update({ situacao: 'concluida', concluida_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`Não deu para concluir: ${error.message}`)
}

/** Reatribuir tarefa avulsa (líder/admin — o RLS decide). */
export async function reatribuirTarefa(id: number, responsavelId: string | null): Promise<void> {
  const { error } = await supabase
    .from('plt_tarefas')
    .update({ responsavel_id: responsavelId })
    .eq('id', id)
  if (error) throw new Error(`Não deu para reatribuir: ${error.message}`)
}
