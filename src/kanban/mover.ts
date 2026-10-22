import type { Estado } from '@/componentes/ui'
import { supabase } from '@/lib/supabase'
import type { EscolhaDeMotivo } from './pausa'
import type { Card } from './tipos'

/**
 * SESSAO-39 (D-173 — ↩️ D-59 para a liderança): o botão MOVER da janela do
 * card. A peça ou o card avulso que está num setor de produção vai para a
 * FILA do setor de produção escolhido (o próprio setor também: volta para a
 * fila), com motivo obrigatório (lista "Motivos do Mover" ou "Outro"). Quem
 * move: líder de qualquer setor, admin e super admin; no tablet, quem digita
 * o PIN. A trava de verdade é do banco (plt_fn_card_mover_para_fila).
 */

export interface ResultadoMover {
  evento_id: number
  setor_id: number
  setor_nome: string
  etapa_id: number
}

export async function moverParaFila(parametros: {
  cardId: number
  setorId: number
  motivo: EscolhaDeMotivo
  /** 🟢🟡🔴 — só quando o setor de origem pede o estado ao enviar (D-126). */
  estadoQualidade?: Estado | null
  /** Tablet compartilhado: o autor é quem digitou o PIN. */
  operadorId?: string | null
}): Promise<ResultadoMover> {
  const { data, error } = await supabase.rpc('plt_fn_card_mover_para_fila', {
    p_card_id: parametros.cardId,
    p_setor_id: parametros.setorId,
    p_motivo_id: parametros.motivo.motivoId,
    p_texto: parametros.motivo.texto.trim() || null,
    p_estado_qualidade: parametros.estadoQualidade ?? null,
    p_operador_id: parametros.operadorId ?? null,
  })
  if (error) throw new Error(error.message)
  return data as ResultadoMover
}

/**
 * O botão aparece? Só no card de produção (peça ou avulso) vivo, num setor de
 * produção. No computador/celular, só para quem é líder (de qualquer setor) ou
 * admin — o nível logística nunca; no tablet do setor, aparece pelo estado e o
 * banco decide com o PIN (como o Pausar).
 */
export function mostraMover(parametros: {
  card: Pick<Card, 'tipo'>
  vivo: boolean
  papelDoSetor: 'entrada' | 'producao' | 'terminal' | null | undefined
  tablet: boolean
  ehLider: boolean
  nivelLogistica: boolean
}): boolean {
  const { card, vivo, papelDoSetor, tablet, ehLider, nivelLogistica } = parametros
  if (!vivo || papelDoSetor !== 'producao') return false
  if (card.tipo !== 'unidade' && card.tipo !== 'avulso') return false
  return tablet || (ehLider && !nivelLogistica)
}
