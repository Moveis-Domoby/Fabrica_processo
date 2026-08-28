import { supabase } from '@/lib/supabase'

/**
 * Camada de dados do controle de tempo do admin (SESSAO-07 / D-29).
 *
 * REGRA DE OURO: nada aqui toca eventos. Horários e pausas são a RÉGUA da
 * medição — o desconto acontece no cálculo derivado (fn_tempo_util), nunca no
 * dado registrado. RLS: todos leem, só admin escreve.
 */

export interface HorarioFuncionamento {
  id: number
  escopo: 'setor' | 'usuario'
  setor_id: number | null
  usuario_id: string | null
  dia_semana: number
  hora_inicio: string
  hora_fim: string
}

export interface PausaTempo {
  id: number
  escopo: 'setor' | 'usuario'
  setor_id: number | null
  usuario_id: string | null
  inicio: string
  fim: string | null
  retroativa: boolean
  motivo: string | null
  criado_por: string
  criado_em: string
}

const COLUNAS_HORARIO = 'id, escopo, setor_id, usuario_id, dia_semana, hora_inicio, hora_fim'
const COLUNAS_PAUSA =
  'id, escopo, setor_id, usuario_id, inicio, fim, retroativa, motivo, criado_por, criado_em'

export async function listarHorarios(): Promise<HorarioFuncionamento[]> {
  const { data, error } = await supabase
    .from('plt_horarios_funcionamento')
    .select(COLUNAS_HORARIO)
    .order('escopo')
    .order('dia_semana')
    .order('hora_inicio')
  if (error) throw new Error(`Não deu para carregar os horários: ${error.message}`)
  return (data ?? []) as HorarioFuncionamento[]
}

export async function criarHorarios(parametros: {
  escopo: 'setor' | 'usuario'
  setorId?: number
  usuarioId?: string
  dias: number[]
  horaInicio: string
  horaFim: string
}): Promise<void> {
  const linhas = parametros.dias.map((dia) => ({
    escopo: parametros.escopo,
    setor_id: parametros.escopo === 'setor' ? parametros.setorId : null,
    usuario_id: parametros.escopo === 'usuario' ? parametros.usuarioId : null,
    dia_semana: dia,
    hora_inicio: parametros.horaInicio,
    hora_fim: parametros.horaFim,
  }))
  const { error } = await supabase.from('plt_horarios_funcionamento').insert(linhas)
  if (error) throw new Error(`Não deu para salvar o horário: ${error.message}`)
}

export async function removerHorario(id: number): Promise<void> {
  const { error } = await supabase.from('plt_horarios_funcionamento').delete().eq('id', id)
  if (error) throw new Error(`Não deu para remover o horário: ${error.message}`)
}

export async function listarPausas(): Promise<PausaTempo[]> {
  const { data, error } = await supabase
    .from('plt_pausas_tempo')
    .select(COLUNAS_PAUSA)
    .order('inicio', { ascending: false })
    .limit(50)
  if (error) throw new Error(`Não deu para carregar as pausas: ${error.message}`)
  return (data ?? []) as PausaTempo[]
}

/** Desligar AGORA (fim aberto) ou registrar uma correção retroativa (D-29). */
export async function criarPausa(parametros: {
  escopo: 'setor' | 'usuario'
  setorId?: number
  usuarioId?: string
  inicio?: string
  fim?: string | null
  retroativa?: boolean
  motivo?: string
  criadoPor: string
}): Promise<void> {
  const { error } = await supabase.from('plt_pausas_tempo').insert({
    escopo: parametros.escopo,
    setor_id: parametros.escopo === 'setor' ? parametros.setorId : null,
    usuario_id: parametros.escopo === 'usuario' ? parametros.usuarioId : null,
    ...(parametros.inicio ? { inicio: parametros.inicio } : {}),
    fim: parametros.fim ?? null,
    retroativa: parametros.retroativa ?? false,
    motivo: parametros.motivo?.trim() || null,
    criado_por: parametros.criadoPor,
  })
  if (error) throw new Error(`Não deu para registrar: ${error.message}`)
}

/** Religa o tempo: fecha a pausa aberta neste instante. */
export async function religarPausa(id: number): Promise<void> {
  const { error } = await supabase
    .from('plt_pausas_tempo')
    .update({ fim: new Date().toISOString() })
    .eq('id', id)
    .is('fim', null)
  if (error) throw new Error(`Não deu para religar: ${error.message}`)
}
