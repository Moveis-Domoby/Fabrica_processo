/**
 * SESSAO-50 (bloco C — pedido do dono, 12/11: "editar endereço de entrega mesmo
 * e corrigindo no pino no mapa"; "o endereço original que veio do Tiny ainda
 * continua no banco como log"; "a pergunta é se ele deseja salvar também no
 * Tiny"): o endereço de entrega do pedido muda NA PLATAFORMA. As portas, os
 * tipos e a lógica pura da janela "Editar endereço" (testada no Vitest).
 *
 * - O banco guarda o original do Tiny inteiro no fato do pedido; a regra única
 *   de "onde entregar" passa a preferir o da plataforma — Rotas, mapa, Entregas
 *   do dia, a ficha e o Google Maps/Waze leem o novo sem mudar nada.
 * - "Salvar na plataforma e no Tiny" fica desligado (o banco recusa e diz por
 *   quê); a tela mostra o porquê que o banco devolve.
 * - Mudar só o pino (sem mexer no texto) é o "marcar o ponto" de sempre — sem
 *   pergunta do Tiny (o Tiny não guarda ponto).
 */
import { supabase } from '@/lib/supabase'

/** O endereço em partes (como o Tiny e a plataforma guardam). */
export interface CamposEndereco {
  endereco: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
}

/** De onde vem o endereço que vale: mudado na plataforma, o de entrega do Tiny ou o do cadastro. */
export type FonteEndereco = 'plataforma' | 'entrega' | 'cadastro'

/** O selo "Endereço alterado na plataforma": o original do Tiny e se o Tiny já confirmou. */
export interface SeloEndereco {
  original: CamposEndereco & { fonte?: 'entrega' | 'cadastro' | string | null }
  tiny_confirmado_em?: string | null
  /** Na ficha (e na janela): quando e quem mudou. */
  em?: string | null
  por?: string | null
  escolha?: 'plataforma' | 'tiny' | string | null
}

/** O que a janela lê ao abrir (uma requisição — Lei §3). */
export interface EnderecoDoPedido {
  pedido_id: number
  numero: number
  situacao: string | null
  card_id: number | null
  entregue: boolean
  pode_editar: boolean
  /** Por que não pode editar (pedido entregue sem ser admin, pedido sem card). */
  motivo: string | null
  fonte: FonteEndereco
  atual: CamposEndereco
  tiny: CamposEndereco & { fonte: 'entrega' | 'cadastro' }
  plataforma: (SeloEndereco & { em: string; por: string | null }) | null
  /** O ponto de agora do endereço que vale (a chave do mapa vem do banco). */
  geo: {
    chave: string | null
    endereco_geocodificavel: string | null
    latitude: number | null
    longitude: number | null
    resolvido: boolean | null
    manual: boolean
  }
  /** "Salvar na plataforma e no Tiny": desligado, sempre com o porquê (do banco). */
  tiny_salvar: { pode: boolean; motivo: string | null }
  /** O mesmo para "Voltar ao endereço original". */
  tiny_restaurar: { pode: boolean; motivo: string | null }
}

export interface ResultadoEndereco {
  mudou: boolean
  restaurado: boolean
}

export async function lerEnderecoDoPedido(pedidoId: number): Promise<EnderecoDoPedido> {
  const { data, error } = await supabase.rpc('plt_fn_pedido_endereco', { p_pedido_id: pedidoId })
  if (error) throw new Error(error.message)
  return data as EnderecoDoPedido
}

/** Salva o endereço novo (o pino, se veio, vira o ponto marcado à mão do endereço novo). */
export async function salvarEnderecoDoPedido(parametros: {
  pedidoId: number
  endereco: CamposEndereco
  latitude: number | null
  longitude: number | null
  tiny?: boolean
}): Promise<ResultadoEndereco> {
  const { data, error } = await supabase.rpc('plt_fn_pedido_endereco_salvar', {
    p_pedido_id: parametros.pedidoId,
    p_endereco: parametros.endereco,
    p_latitude: parametros.latitude,
    p_longitude: parametros.longitude,
    p_tiny: parametros.tiny ?? false,
  })
  if (error) throw new Error(error.message)
  const r = data as Partial<ResultadoEndereco> | null
  return { mudou: Boolean(r?.mudou), restaurado: Boolean(r?.restaurado) }
}

/** "Voltar ao endereço original" (o do Tiny). */
export async function restaurarEnderecoDoPedido(parametros: {
  pedidoId: number
  tiny?: boolean
}): Promise<ResultadoEndereco> {
  const { data, error } = await supabase.rpc('plt_fn_pedido_endereco_restaurar', {
    p_pedido_id: parametros.pedidoId,
    p_tiny: parametros.tiny ?? false,
  })
  if (error) throw new Error(error.message)
  const r = data as Partial<ResultadoEndereco> | null
  return { mudou: Boolean(r?.mudou), restaurado: Boolean(r?.restaurado) }
}

/** As telas que mostram o endereço ou o ponto do pedido (releem depois de mudar). */
export const CHAVES_DO_ENDERECO: string[][] = [
  ['programacao'],
  ['programadas'],
  ['entregas-do-dia'],
  ['rotas'],
  ['rotas-calendario'],
]

// ---------------------------------------------------------------------------
// Lógica pura
// ---------------------------------------------------------------------------

export const CAMPOS_VAZIOS: CamposEndereco = {
  endereco: null,
  numero: null,
  complemento: null,
  bairro: null,
  cidade: null,
  uf: null,
  cep: null,
}

const juntarEspacos = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, ' ').trim()

/** O que a pessoa escreveu, limpo — a mesma régua do banco (espaços, UF maiúscula, CEP 00000-000). */
export function limparCampos(c: Partial<CamposEndereco>): CamposEndereco {
  const texto = (t: string | null | undefined) => juntarEspacos(t) || null
  const digitos = (c.cep ?? '').replace(/\D/g, '')
  return {
    endereco: texto(c.endereco),
    numero: texto(c.numero),
    complemento: texto(c.complemento),
    bairro: texto(c.bairro),
    cidade: texto(c.cidade),
    uf: (c.uf ?? '').replace(/\s/g, '').toUpperCase() || null,
    cep:
      digitos === ''
        ? null
        : digitos.length === 8
          ? `${digitos.slice(0, 5)}-${digitos.slice(5)}`
          : digitos,
  }
}

/** A régua de nome da casa: sem acento, sem caixa, sem espaço (a mesma do banco). */
function comparavel(t: string | null | undefined): string {
  return (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '')
}

/** O mesmo endereço? (a régua do banco: sem acento, caixa ou espaço; o CEP só com os números) */
export function mesmoEndereco(a: CamposEndereco, b: CamposEndereco): boolean {
  const partes: (keyof CamposEndereco)[] = [
    'endereco',
    'numero',
    'complemento',
    'bairro',
    'cidade',
    'uf',
  ]
  return (
    partes.every((k) => comparavel(a[k]) === comparavel(b[k])) &&
    (a.cep ?? '').replace(/\D/g, '') === (b.cep ?? '').replace(/\D/g, '')
  )
}

/** O que falta (ou está errado) para salvar — a mesma conferência do banco, em língua de gente. */
export function problemasDoEndereco(c: CamposEndereco): string[] {
  const p: string[] = []
  if ((c.endereco ?? '').length < 3) p.push('a rua (ou avenida, travessa…)')
  if ((c.cidade ?? '').length < 2) p.push('a cidade')
  if (!/^[A-Z]{2}$/.test(c.uf ?? '')) p.push('a UF com 2 letras (ex.: RN)')
  const digitos = (c.cep ?? '').replace(/\D/g, '')
  if (digitos !== '' && digitos.length !== 8) p.push('o CEP com 8 números (ou em branco)')
  return p
}

/** O endereço numa linha, como as telas mostram ("Rua X, 55 · Centro · Natal-RN"). */
export function enderecoEmLinha(c: Partial<CamposEndereco> | null | undefined): string {
  if (!c) return 'Sem endereço'
  const partes = [
    [c.endereco, c.numero].filter(Boolean).join(', '),
    c.bairro,
    [c.cidade, c.uf].filter(Boolean).join('-'),
  ].filter(Boolean)
  return partes.join(' · ') || 'Sem endereço'
}

/** O complemento e o CEP, quando há (a 2ª linha do endereço na janela de/para). */
export function complementoECep(c: Partial<CamposEndereco> | null | undefined): string {
  if (!c) return ''
  return [c.complemento, c.cep ? `CEP ${c.cep}` : null].filter(Boolean).join(' · ')
}

/** O texto para a busca do mapa ("Rua X 55, Centro, Natal, RN, 59000-000"). */
export function textoParaBusca(c: CamposEndereco): string {
  return [[c.endereco, c.numero].filter(Boolean).join(' '), c.bairro, c.cidade, c.uf, c.cep]
    .filter((x) => (x ?? '').trim() !== '')
    .join(', ')
}

/** De onde vem o endereço, em língua de gente (o rótulo do "De:" na pergunta). */
export function rotuloDaFonte(
  fonte: FonteEndereco | 'entrega' | 'cadastro' | string | null | undefined,
): string {
  if (fonte === 'plataforma') return 'alterado na plataforma'
  if (fonte === 'entrega') return 'endereço de entrega do Tiny'
  if (fonte === 'cadastro') return 'cadastro do cliente no Tiny'
  return 'Tiny'
}
