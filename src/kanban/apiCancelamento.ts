import { supabase } from '@/lib/supabase'

/**
 * SESSAO-48 (frente 4): o administrador traz de volta a peça com a fabricação
 * cancelada que já saiu da coluna (a rotina da madrugada a arquivou depois do
 * prazo). Ela volta para a FILA do setor dela, sem dono; recuperar de novo não
 * faz nada. O banco confere quem pode.
 */
export interface RecuperacaoPeca {
  feito: boolean
  motivo?: 'nao_cancelada'
  etapa?: string
}

export async function recuperarPecaCancelada(cardId: number): Promise<RecuperacaoPeca> {
  const { data, error } = await supabase.rpc('plt_fn_peca_cancelada_recuperar', {
    p_card_id: cardId,
  })
  if (error) throw new Error(error.message)
  return data as RecuperacaoPeca
}
