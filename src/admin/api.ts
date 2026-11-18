import { FunctionsHttpError } from '@supabase/supabase-js'
import type { QueryClient } from '@tanstack/react-query'
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

/**
 * SESSAO-55 (Lei §3 — 1 requisição por clique): o bloco "Desligar o tempo" numa
 * leitura — os nomes das pessoas, os horários e as pausas vêm juntos e entram
 * no cache com as chaves de sempre (E-22); cada lista relê sozinha só no gesto
 * que a muda.
 */
export async function abrirDesligarTempo(clienteQuery: QueryClient): Promise<true> {
  const { data, error } = await supabase.rpc('plt_fn_tempo_desligar_abertura')
  if (error) throw new Error(`Não deu para carregar o controle de tempo: ${error.message}`)
  const r = data as {
    usuarios: { id: string; nome: string }[]
    horarios: HorarioFuncionamento[]
    pausas: PausaTempo[]
  }
  clienteQuery.setQueryData(['usuarios', 'nomes'], new Map(r.usuarios.map((u) => [u.id, u.nome])))
  clienteQuery.setQueryData(['horarios'], r.horarios)
  clienteQuery.setQueryData(['pausas'], r.pausas)
  return true
}

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
  const hash = Array.from(new Uint8Array(hashBytes), (b) => b.toString(16).padStart(2, '0')).join(
    '',
  )
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

export interface ApiIntegracoes {
  chaves: ChaveApi[]
  webhooks: Webhook[]
  entregas: EntregaWebhook[]
}

export const CHAVE_API_INTEGRACOES = ['api-integracoes'] as const

/**
 * SESSAO-55 (Lei §2): Configurações → API e integrações numa requisição — as
 * chaves, os webhooks e as últimas entregas (antes eram 3 leituras). A porta lê
 * as mesmas tabelas com a permissão de quem pede (só admin vê).
 */
export async function abrirApiIntegracoes(): Promise<ApiIntegracoes> {
  const { data, error } = await supabase.rpc('plt_fn_api_abertura')
  if (error) throw new Error(`Não deu para carregar as integrações: ${error.message}`)
  const r = (data ?? {}) as Partial<ApiIntegracoes>
  return { chaves: r.chaves ?? [], webhooks: r.webhooks ?? [], entregas: r.entregas ?? [] }
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

/**
 * SESSAO-33 (D-142): "Ligar a API nova da fábrica" — o dono pede ao renovador
 * próprio da fábrica (Edge Function `tiny-fabrica-token`) o endereço de
 * autorização do Tiny e o navegador vai para lá; na volta, o Tiny devolve o
 * dono a `volta` com `?tiny_fabrica=ligada` (ou `erro`). Nenhum token passa
 * pelo navegador — ele fica no banco, e só a ponte do n8n o lê.
 */
export async function iniciarApiNovaFabrica(volta: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('tiny-fabrica-token', {
    body: { acao: 'iniciar', volta },
  })
  if (error) {
    let mensagem = 'Não deu para falar com o Tiny agora. Tente de novo em instantes.'
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
  const url = (data as { url?: string } | null)?.url
  if (!url) throw new Error('O Tiny não devolveu o endereço de autorização.')
  return url
}
