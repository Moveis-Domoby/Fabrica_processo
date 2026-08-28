import { supabase } from '@/lib/supabase'

/**
 * Avisos de plt_notificacoes (SESSAO-06 / D-09 / Q-18): o banco os cria
 * sozinho — 🟡/🔴 na entrega, divergência no recebimento, chegada em ESTOQUE.
 * Canal por ora é a plataforma (WhatsApp/e-mail é a Q-42, em aberto).
 * "Lida" é estado de leitura, não história — por isso aqui há UPDATE; o FATO
 * que gerou o aviso continua imutável em plt_eventos.
 */
export interface Aviso {
  id: number
  tipo: string
  titulo: string
  corpo: string
  card_id: number | null
  lida_em: string | null
  criada_em: string
}

export async function buscarAvisos(usuarioId: string, limite = 20): Promise<Aviso[]> {
  const { data, error } = await supabase
    .from('plt_notificacoes')
    .select('id, tipo, titulo, corpo, card_id, lida_em, criada_em')
    .eq('destinatario_id', usuarioId)
    .order('criada_em', { ascending: false })
    .limit(limite)
  if (error) throw new Error(`Não deu para carregar os avisos: ${error.message}`)
  return (data ?? []) as Aviso[]
}

export async function marcarAvisoLido(id: number): Promise<void> {
  const { error } = await supabase
    .from('plt_notificacoes')
    .update({ lida_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`Não deu para marcar o aviso como lido: ${error.message}`)
}

export async function marcarTodosLidos(usuarioId: string): Promise<void> {
  const { error } = await supabase
    .from('plt_notificacoes')
    .update({ lida_em: new Date().toISOString() })
    .eq('destinatario_id', usuarioId)
    .is('lida_em', null)
  if (error) throw new Error(`Não deu para marcar os avisos como lidos: ${error.message}`)
}
