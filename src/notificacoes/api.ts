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

/**
 * Histórico completo de avisos, paginado NO SERVIDOR (SESSAO-23 — "Ver todos"
 * do sino; regra 17: a tela só requisita a página que mostra, e o total vem da
 * mesma consulta).
 */
export async function buscarAvisosPagina(parametros: {
  usuarioId: string
  pagina: number
  porPagina: number
}): Promise<{ avisos: Aviso[]; total: number }> {
  const { usuarioId, pagina, porPagina } = parametros
  const de = (pagina - 1) * porPagina
  const { data, error, count } = await supabase
    .from('plt_notificacoes')
    .select('id, tipo, titulo, corpo, card_id, lida_em, criada_em', { count: 'exact' })
    .eq('destinatario_id', usuarioId)
    .order('criada_em', { ascending: false })
    .range(de, de + porPagina - 1)
  if (error) throw new Error(`Não deu para carregar os avisos: ${error.message}`)
  return { avisos: (data ?? []) as Aviso[], total: count ?? 0 }
}

export async function marcarAvisoLido(id: number): Promise<void> {
  const { error } = await supabase
    .from('plt_notificacoes')
    .update({ lida_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`Não deu para marcar o aviso como lido: ${error.message}`)
}

/** Apagar UM aviso já lido (a história do fato segue em plt_eventos). */
export async function apagarAviso(id: number): Promise<void> {
  const { error } = await supabase.from('plt_notificacoes').delete().eq('id', id)
  if (error) throw new Error(`Não deu para apagar o aviso: ${error.message}`)
}

/** Apagar todos os avisos já lidos — o RLS só deixa apagar os seus, lidos. */
export async function apagarLidas(usuarioId: string): Promise<void> {
  const { error } = await supabase
    .from('plt_notificacoes')
    .delete()
    .eq('destinatario_id', usuarioId)
    .not('lida_em', 'is', null)
  if (error) throw new Error(`Não deu para apagar os avisos lidos: ${error.message}`)
}

export async function marcarTodosLidos(usuarioId: string): Promise<void> {
  const { error } = await supabase
    .from('plt_notificacoes')
    .update({ lida_em: new Date().toISOString() })
    .eq('destinatario_id', usuarioId)
    .is('lida_em', null)
  if (error) throw new Error(`Não deu para marcar os avisos como lidos: ${error.message}`)
}
