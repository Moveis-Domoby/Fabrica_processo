import { supabase } from '@/lib/supabase'
import type { CampoCustomizado, Etiqueta, ValorCampo } from '@/utilitarios/tipos'
import type { Card, Etapa, ExecucaoAberta, PedidoDoCard } from './tipos'

/**
 * SESSAO-31 (Lei de Desempenho §2/§6 — regra 18): o quadro do setor (e o
 * tablet) numa REQUISIÇÃO só — a 1ª página de todas as colunas e o que elas
 * mostram (execuções, pessoas, pedidos, campos, catálogos). "Ver mais" = 1
 * requisição daquela coluna, por cursor.
 */
export const CARDS_POR_COLUNA = 10

export interface PessoaDoQuadro {
  nome: string
  foto: string | null
}

/** SESSAO-36 (D-146): um auxílio aberto num card — o tempo PRÓPRIO da pessoa. */
export interface AuxilioAberto {
  card_id: number
  usuario_id: string
  iniciado_em: string
  pausado_em: string | null
  pausa_motivo: string | null
  /** o tempo já fechado (sem pausas), em segundos */
  segundos: number
  /** o começo do trecho aberto de agora; nulo = pausado */
  ultimo_inicio: string | null
}

/** SESSAO-36: quem está presente no setor (o ícone do canto superior direito). */
export interface PresencaDoSetor {
  usuario_id: string
  nome: string
  foto: string | null
  estado: 'trabalhando' | 'ausente' | 'deriva'
  desde: string
}

/** O que vem junto com uma página de cards. */
export interface JuntoDoQuadro {
  execucoes: ExecucaoAberta[]
  /** SESSAO-36: os auxílios abertos dos cards da página. */
  auxilios: AuxilioAberto[]
  pessoas: Record<string, PessoaDoQuadro>
  pedidos: Record<string, PedidoDoCard>
  valores: { campo_id: number; card_id: number; valor: ValorCampo }[]
}

export interface ColunaDoQuadro {
  /** null = a "Chegada" (card sem etapa). */
  etapa_id: number | null
  total: number
  cards: Card[]
}

export interface DadosDoQuadro extends JuntoDoQuadro {
  setor_id: number
  por_coluna: number
  etapas: Etapa[]
  colunas: ColunaDoQuadro[]
  etiquetas: Etiqueta[]
  campos: CampoCustomizado[]
  /** SESSAO-36: as pessoas presentes no setor (trabalhando/ausente). */
  presencas: PresencaDoSetor[]
}

export interface PaginaDaColuna extends JuntoDoQuadro {
  etapa_id: number | null
  cards: Card[]
}

export async function quadroSetor(
  setorId: number,
  porColuna = CARDS_POR_COLUNA,
): Promise<DadosDoQuadro> {
  const { data, error } = await supabase.rpc('plt_fn_quadro_setor', {
    p_setor_id: setorId,
    p_por_coluna: porColuna,
  })
  if (error) throw new Error(`Não deu para carregar o quadro: ${error.message}`)
  return data as DadosDoQuadro
}

/** "Ver mais": a página seguinte de UMA coluna, depois do último card mostrado. */
export async function quadroColuna(parametros: {
  setorId: number
  etapaId: number | null
  depoisDe: Pick<Card, 'id' | 'desde'> | undefined
  limite?: number
}): Promise<PaginaDaColuna> {
  const { data, error } = await supabase.rpc('plt_fn_quadro_coluna', {
    p_setor_id: parametros.setorId,
    p_etapa_id: parametros.etapaId,
    p_depois_desde: parametros.depoisDe?.desde ?? null,
    p_depois_id: parametros.depoisDe?.id ?? 0,
    p_limite: parametros.limite ?? CARDS_POR_COLUNA,
  })
  if (error) throw new Error(`Não deu para carregar mais cards: ${error.message}`)
  return data as PaginaDaColuna
}
