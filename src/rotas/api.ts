import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * Camada de dados do módulo de ROTAS (SESSAO-11 / D-33, revista na SESSAO-15 /
 * D-39 / D-45): a entrega é por PEDIDO COMPLETO e SÓ o pedido lançado pelos
 * Pedidos em aguardo aparece aqui. O gate (logística: admin, PCP, terminais)
 * vive nas funções do banco. Endereço e contato aparecem de propósito — é o
 * que o entregador precisa (o mesmo que o card do ClickUp mostrava).
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
  situacao_entrega: 'pronta' | 'entregue'
  entregue_em: string | null
  entregue_por: string | null
  lancado_em: string | null
  /** D-39: o dia e o caminhão programados, quando há. */
  programacao_data: string | null
  caminhao_id: number | null
  caminhao_nome: string | null
  caminhao_placa: string | null
  caminhao_foto: string | null
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
export function enderecoLegivel(e: {
  endereco: string | null
  numero_endereco: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
}): string {
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

// ---------------------------------------------------------------------------
// Programação de caminhão (D-39/D-45)
// ---------------------------------------------------------------------------

export interface PedidoProgramacao {
  card_id: number
  pedido_id: number
  numero: number
  cliente_nome: string
  endereco: string | null
  numero_endereco: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  /** O que se manda ao geocodificador; null = sem endereço nenhum. */
  endereco_geocodificavel: string | null
  /** Chave do cache, calculada no banco (md5 do endereço normalizado). */
  geo_chave: string | null
  latitude: number | null
  longitude: number | null
  /** null = nunca consultado; false = consultado e sem ponto (Q-65). */
  geo_resolvido: boolean | null
  geo_consultado_em: string | null
  total_unidades: number
  data_prevista: string | null
  lancado_em: string | null
  programacao_data: string | null
  caminhao_id: number | null
  caminhao_nome: string | null
  contagem_total: number
}

/**
 * Os pedidos da programação: SEM programação (sempre) + os programados no dia
 * pedido. Vem com o ponto do cache quando já geocodificado.
 */
export async function listarProgramacao(parametros: {
  data?: string | null
  limite?: number
  deslocamento?: number
}): Promise<PedidoProgramacao[]> {
  const { data, error } = await supabase.rpc('plt_fn_programacao', {
    p_data: parametros.data ?? null,
    p_limite: parametros.limite ?? 100,
    p_deslocamento: parametros.deslocamento ?? 0,
  })
  if (error) throw new Error(`Não deu para carregar a programação: ${error.message}`)
  return (data ?? []) as PedidoProgramacao[]
}

/** Programar ou reprogramar (D-45): data + caminhão; o banco recusa depois de entregue. */
export async function programarEntrega(parametros: {
  cardId: number
  data: string
  caminhaoId: number
}): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_programar_entrega', {
    p_card_id: parametros.cardId,
    p_data: parametros.data,
    p_caminhao_id: parametros.caminhaoId,
  })
  if (error) throw new Error(`Não deu para programar: ${error.message}`)
}

export async function desprogramarEntrega(cardId: number): Promise<void> {
  const { error } = await supabase.rpc('plt_fn_desprogramar_entrega', { p_card_id: cardId })
  if (error) throw new Error(`Não deu para tirar da programação: ${error.message}`)
}

export interface ResultadoGeocodificacao {
  chave: string
  latitude: number | null
  longitude: number | null
  resolvido: boolean
}

/**
 * Geocodificação pela Edge Function `geocodificar` (Nominatim com ritmo e
 * identificação — o navegador não consegue garantir nenhum dos dois). Até 10
 * por chamada; o resultado já fica no cache do banco.
 */
export async function geocodificar(
  itens: { chave: string; endereco: string }[],
): Promise<ResultadoGeocodificacao[]> {
  if (itens.length === 0) return []
  const { data, error } = await supabase.functions.invoke('geocodificar', {
    body: { itens: itens.slice(0, 10) },
  })
  if (error) {
    let mensagem = 'Não consegui consultar o mapa. Confira a internet e tente de novo.'
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
  return ((data as { resultados?: ResultadoGeocodificacao[] })?.resultados ?? [])
}

/** Falha de geocodificação vale por 7 dias (a Edge Function também não insiste). */
const RETENTAR_APOS_MS = 7 * 24 * 60 * 60 * 1000

/** Quem ainda precisa ir ao geocodificador. */
export function precisaGeocodificar(p: PedidoProgramacao, agora = Date.now()): boolean {
  if (!p.geo_chave || !p.endereco_geocodificavel) return false
  if (p.geo_resolvido === true) return false
  if (p.geo_resolvido === null) return true
  const consultado = p.geo_consultado_em ? new Date(p.geo_consultado_em).getTime() : 0
  return agora - consultado > RETENTAR_APOS_MS
}
