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

// ---------------------------------------------------------------------------
// Chaves de API e webhooks (SESSAO-11 / Q-50 / RF-52 — RLS: só admin)
// ---------------------------------------------------------------------------

export interface ChaveApi {
  id: number
  nome: string
  prefixo: string
  escopo: 'leitura' | 'escrita'
  criada_em: string
  revogada_em: string | null
  ultimo_uso_em: string | null
}

export async function listarChavesApi(): Promise<ChaveApi[]> {
  const { data, error } = await supabase
    .from('plt_chaves_api')
    .select('id, nome, prefixo, escopo, criada_em, revogada_em, ultimo_uso_em')
    .order('criada_em', { ascending: false })
  if (error) throw new Error(`Não deu para carregar as chaves: ${error.message}`)
  return (data ?? []) as ChaveApi[]
}

/**
 * Gera a chave NO NAVEGADOR e guarda só o hash (Q-50): o valor `pltk_…` é
 * devolvido UMA vez para o admin copiar — nunca mais aparece.
 */
export async function criarChaveApi(parametros: {
  nome: string
  escopo: 'leitura' | 'escrita'
  criadaPor: string
}): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const valor = `pltk_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
  const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(valor))
  const hash = Array.from(new Uint8Array(hashBytes), (b) => b.toString(16).padStart(2, '0')).join('')
  const { error } = await supabase.from('plt_chaves_api').insert({
    nome: parametros.nome.trim(),
    hash,
    prefixo: valor.slice(0, 9),
    escopo: parametros.escopo,
    criada_por: parametros.criadaPor,
  })
  if (error) throw new Error(`Não deu para criar a chave: ${error.message}`)
  return valor
}

/** Revogar corta o acesso NA HORA — a Edge Function só aceita revogada_em null. */
export async function revogarChaveApi(id: number): Promise<void> {
  const { error } = await supabase
    .from('plt_chaves_api')
    .update({ revogada_em: new Date().toISOString() })
    .eq('id', id)
    .is('revogada_em', null)
  if (error) throw new Error(`Não deu para revogar: ${error.message}`)
}

export const EVENTOS_WEBHOOK = [
  'card_criado',
  'movimentacao_setor',
  'movimentacao_etapa',
  'execucao_iniciada',
  'execucao_finalizada',
  'qualidade_marcada',
  'qualidade_parecer',
  'pedido_atualizado',
  'pedido_cancelado',
  'pedido_entregue',
  'card_arquivado',
] as const

export interface Webhook {
  id: number
  nome: string
  url: string
  eventos: string[]
  ativo: boolean
  criado_em: string
}

export interface EntregaWebhook {
  id: number
  webhook_id: number
  situacao: 'pendente' | 'enviada' | 'falha'
  tentativas: number
  ultimo_erro: string | null
  criada_em: string
}

export async function listarWebhooks(): Promise<Webhook[]> {
  const { data, error } = await supabase
    .from('plt_webhooks')
    .select('id, nome, url, eventos, ativo, criado_em')
    .order('criado_em', { ascending: false })
  if (error) throw new Error(`Não deu para carregar os webhooks: ${error.message}`)
  return (data ?? []) as Webhook[]
}

export async function criarWebhook(parametros: {
  nome: string
  url: string
  eventos: string[]
  segredo?: string
  criadoPor: string
}): Promise<void> {
  const { error } = await supabase.from('plt_webhooks').insert({
    nome: parametros.nome.trim(),
    url: parametros.url.trim(),
    eventos: parametros.eventos,
    segredo: parametros.segredo?.trim() || null,
    criado_por: parametros.criadoPor,
  })
  if (error) throw new Error(`Não deu para criar o webhook: ${error.message}`)
}

export async function alternarWebhook(id: number, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('plt_webhooks').update({ ativo }).eq('id', id)
  if (error) throw new Error(`Não deu para atualizar o webhook: ${error.message}`)
}

export async function entregasRecentes(): Promise<EntregaWebhook[]> {
  const { data, error } = await supabase
    .from('plt_webhook_entregas')
    .select('id, webhook_id, situacao, tentativas, ultimo_erro, criada_em')
    .order('criada_em', { ascending: false })
    .limit(20)
  if (error) throw new Error(`Não deu para carregar as entregas: ${error.message}`)
  return (data ?? []) as EntregaWebhook[]
}
