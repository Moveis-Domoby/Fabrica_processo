/**
 * Etiquetas e campos customizados (SESSAO-27 · D-101) — Configurações →
 * Utilitários. As etiquetas as automações põem e tiram dos cards (várias por
 * card); os campos valem nas peças e/ou nos pedidos (o card do pedido no PCP e
 * o pedido são o MESMO valor), preenchidos pela automação e pelo admin.
 */

export const CORES_ETIQUETA = ['azul', 'violeta', 'ciano', 'rosa', 'marrom', 'cinza'] as const
export type CorEtiqueta = (typeof CORES_ETIQUETA)[number]

export const ROTULO_COR: Record<CorEtiqueta, string> = {
  azul: 'Azul',
  violeta: 'Violeta',
  ciano: 'Ciano',
  rosa: 'Rosa',
  marrom: 'Marrom',
  cinza: 'Cinza',
}

/** Classes POR EXTENSO (A-07: o Tailwind não enxerga classe montada). */
export const CLASSE_ETIQUETA: Record<CorEtiqueta, string> = {
  azul: 'border-etiqueta-azul-borda bg-etiqueta-azul-fundo text-etiqueta-azul-texto',
  violeta: 'border-etiqueta-violeta-borda bg-etiqueta-violeta-fundo text-etiqueta-violeta-texto',
  ciano: 'border-etiqueta-ciano-borda bg-etiqueta-ciano-fundo text-etiqueta-ciano-texto',
  rosa: 'border-etiqueta-rosa-borda bg-etiqueta-rosa-fundo text-etiqueta-rosa-texto',
  marrom: 'border-etiqueta-marrom-borda bg-etiqueta-marrom-fundo text-etiqueta-marrom-texto',
  cinza: 'border-etiqueta-cinza-borda bg-etiqueta-cinza-fundo text-etiqueta-cinza-texto',
}

export function ehCorEtiqueta(valor: unknown): valor is CorEtiqueta {
  return typeof valor === 'string' && (CORES_ETIQUETA as readonly string[]).includes(valor)
}

export interface Etiqueta {
  id: number
  nome: string
  cor: CorEtiqueta
  arquivada_em: string | null
}

export const TIPOS_CAMPO = ['texto', 'numero', 'data', 'lista', 'sim_nao'] as const
export type TipoCampo = (typeof TIPOS_CAMPO)[number]

export const ROTULO_TIPO_CAMPO: Record<TipoCampo, string> = {
  texto: 'Texto',
  numero: 'Número',
  data: 'Data',
  lista: 'Lista de opções',
  sim_nao: 'Sim ou não',
}

export interface CampoCustomizado {
  id: number
  nome: string
  tipo: TipoCampo
  opcoes: string[]
  em_pecas: boolean
  em_pedidos: boolean
  arquivado_em: string | null
}

export type ValorCampo = string | number | boolean

export interface ValorDeCampo {
  campo_id: number
  card_id: number | null
  pedido_id: number | null
  valor: ValorCampo
}

/** O valor em língua de gente (data dd/mm/aaaa, sim/não, número com vírgula). */
export function textoDoValorCampo(campo: Pick<CampoCustomizado, 'tipo'>, valor: ValorCampo | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (campo.tipo === 'sim_nao') return valor === true || valor === 'true' ? 'Sim' : 'Não'
  if (campo.tipo === 'data' && typeof valor === 'string') {
    const [ano, mes, dia] = valor.split('-')
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : valor
  }
  if (campo.tipo === 'numero') return Number(valor).toLocaleString('pt-BR')
  return String(valor)
}
