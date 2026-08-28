import { supabase } from '@/lib/supabase'

/**
 * Camada de dados do módulo de ROTAS (SESSAO-11 / D-33): a entrega é por
 * PEDIDO COMPLETO. O gate (logística: admin, PCP, terminais) vive na função
 * do banco. Endereço e contato aparecem AQUI de propósito — é o que o
 * entregador precisa (o mesmo que o card do ClickUp mostra hoje).
 */

export interface Entrega {
  card_id: number
  pedido_id: number
  numero: number
  cliente_nome: string
  telefone: string | null
  endereco: string | null
  numero_endereco: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  obs: string | null
  data_prevista: string | null
  total_unidades: number
  unidades_em_rotas: number
  situacao_entrega: 'aguardando' | 'pronta' | 'entregue'
  entregue_em: string | null
  entregue_por: string | null
  contagem_total: number
}

export async function listarEntregas(parametros: {
  situacao?: string | null
  busca?: string
  limite?: number
  deslocamento?: number
}): Promise<Entrega[]> {
  const { data, error } = await supabase.rpc('plt_fn_rotas', {
    p_situacao: parametros.situacao ?? null,
    p_busca: parametros.busca || null,
    p_limite: parametros.limite ?? 20,
    p_deslocamento: parametros.deslocamento ?? 0,
  })
  if (error) throw new Error(`Não deu para carregar as rotas: ${error.message}`)
  return (data ?? []) as Entrega[]
}

/** Marca o pedido COMPLETO como entregue (evento append-only; o banco valida). */
export async function registrarEntrega(parametros: {
  cardId: number
  observacao?: string
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_registrar_entrega', {
    p_card_id: parametros.cardId,
    p_observacao: parametros.observacao?.trim() || null,
  })
  if (error) throw new Error(`Não deu para registrar a entrega: ${error.message}`)
}

/** Endereço em linha única (o formato do card real de entrega). */
export function enderecoLegivel(e: Entrega): string {
  const partes = [
    [e.endereco, e.numero_endereco].filter(Boolean).join(', '),
    e.bairro,
    [e.cidade, e.uf].filter(Boolean).join('-'),
  ].filter(Boolean)
  return partes.join(' · ') || 'Sem endereço cadastrado'
}

/** Link do WhatsApp (wa.me) a partir do telefone cru. */
export function linkWhatsApp(telefone: string | null): string | null {
  const digitos = (telefone ?? '').replace(/\D/g, '')
  if (digitos.length < 10) return null
  return `https://wa.me/55${digitos}`
}

/** Link do mapa, como no card real. */
export function linkMapa(e: Entrega): string | null {
  const endereco = [e.endereco, e.numero_endereco, e.bairro, e.cidade, e.uf]
    .filter(Boolean)
    .join(', ')
  if (!endereco) return null
  return `https://www.google.com/maps/search/${encodeURIComponent(endereco)}`
}
