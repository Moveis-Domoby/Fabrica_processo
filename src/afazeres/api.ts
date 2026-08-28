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
}

const COLUNAS_TAREFA =
  'id, titulo, descricao, card_id, setor_id, responsavel_id, criada_por_id, ' +
  'delegacao, situacao, prazo, iniciada_em, concluida_em, criada_em'

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
    .order('criada_em', { ascending: true })
  if (error) throw new Error(`Não deu para carregar suas tarefas: ${error.message}`)
  return (data ?? []) as unknown as Tarefa[]
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
}): Promise<void> {
  const { error } = await supabase.from('plt_tarefas').insert({
    titulo: parametros.titulo.trim(),
    descricao: parametros.descricao?.trim() || null,
    setor_id: parametros.setorId ?? null,
    responsavel_id: parametros.responsavelId ?? null,
    criada_por_id: parametros.criadaPor,
    delegacao: 'direta',
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
