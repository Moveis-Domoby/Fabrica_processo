import { supabase } from '@/lib/supabase'

/**
 * SESSAO-31 (§4 · D-125 resp. 9 — ↩️ D-59/D-48): a PAUSA COM MOTIVO. Pausar
 * um card em execução pede o motivo (da lista "Motivos de pausa" ou "Outro",
 * escrito); quem pausa: o próprio operador, o líder do setor ou o admin — a
 * trava é do banco. Pausado não conta tempo nem ocupa o limite (D-48).
 * Soltar o card em execução na etapa que pede o motivo (o PARADO) fecha o
 * tempo como sempre (D-59), com o motivo no fato e na frente do card.
 */

/**
 * SESSAO-42 (regra 2 e o card esquecido): as pausas que o SISTEMA faz sozinho
 * — no fim do expediente do setor ("Fim do expediente") e na pergunta "ainda
 * tem alguém?" sem resposta ("Sem resposta ao aviso"). O card mostra cada uma
 * com ícone e texto próprios.
 */
export type PausaAutomatica = 'fim_expediente' | 'sem_resposta'

export const TEXTO_PAUSA_AUTOMATICA: Record<PausaAutomatica, string> = {
  fim_expediente: 'fim do expediente',
  sem_resposta: 'sem resposta ao aviso',
}

/** O motivo da pausa é uma pausa do sistema? (nulo = pausa de gente, com o motivo dela) */
export function pausaAutomatica(motivo: string | null | undefined): PausaAutomatica | null {
  const texto = (motivo ?? '').trim().toLowerCase()
  if (texto.startsWith('fim do expediente')) return 'fim_expediente'
  if (texto.startsWith('sem resposta ao aviso')) return 'sem_resposta'
  return null
}

export interface EscolhaDeMotivo {
  /** Um motivo da lista; nulo = "Outro" (o texto é o motivo). */
  motivoId: number | null
  /** O detalhe (com motivo da lista) ou o próprio motivo ("Outro"). */
  texto: string
}

/** Pausar (a janela do card). O toque repetido não pausa de novo (o banco devolve nulo). */
export async function pausarCard(parametros: {
  cardId: number
  motivo: EscolhaDeMotivo
  /** Tablet compartilhado: o autor é quem digitou o PIN. */
  operadorId?: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_card_pausar', {
    p_card_id: parametros.cardId,
    p_motivo_id: parametros.motivo.motivoId,
    p_texto: parametros.motivo.texto.trim() || null,
    p_operador_id: parametros.operadorId ?? null,
  })
  if (error) throw new Error(error.message)
}

/** Retomar: volta a contar (com outra execução aberta, o banco recusa — D-48). */
export async function retomarCard(parametros: {
  cardId: number
  operadorId?: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_card_retomar', {
    p_card_id: parametros.cardId,
    p_operador_id: parametros.operadorId ?? null,
  })
  if (error) throw new Error(error.message)
}

/** Soltar o card em execução na etapa de parada (o PARADO), com o motivo. */
export async function pararCard(parametros: {
  cardId: number
  etapaId: number
  motivo: EscolhaDeMotivo
  operadorId?: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_card_parar', {
    p_card_id: parametros.cardId,
    p_etapa_id: parametros.etapaId,
    p_motivo_id: parametros.motivo.motivoId,
    p_texto: parametros.motivo.texto.trim() || null,
    p_operador_id: parametros.operadorId ?? null,
  })
  if (error) throw new Error(error.message)
}
