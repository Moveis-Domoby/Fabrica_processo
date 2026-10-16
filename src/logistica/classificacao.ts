import { supabase } from '@/lib/supabase'

/**
 * Configurações → Móveis, insumos e peças (SESSAO-32 · D-138). Cada produto do
 * catálogo do Tiny tem um TIPO no estoque: o automático vem do cadastro do
 * Tiny (fabricado e com variação = móvel; simples = móvel só com o código
 * fiscal de móvel; matéria-prima por peça = peça; o resto = insumo) e o admin
 * pode trocar à mão quando algum produto nascer errado. As contas de móveis
 * (Top, mínimo, reposição, contagem) só olham para o tipo móvel; insumo e peça
 * vão para a aba de insumos do Estoque.
 */

export type TipoEstoque = 'movel' | 'insumo' | 'peca'

export const ROTULO_TIPO: Record<TipoEstoque, string> = {
  movel: 'Móvel',
  insumo: 'Insumo',
  peca: 'Peça',
}

/** A classe do produto no Tiny, em língua de gente. */
export const ROTULO_CLASSE_TINY: Record<string, string> = {
  F: 'Fabricado',
  S: 'Simples',
  M: 'Matéria-prima',
  K: 'Kit',
  V: 'Com variação',
}

export interface ProdutoClassificado {
  tiny_id: number
  codigo: string | null
  descricao: string
  classe: string | null
  unidade: string | null
  ncm: string | null
  situacao: string | null
  tipo: TipoEstoque
  tipo_automatico: TipoEstoque
  definido_a_mao: boolean
  imagem_caminho: string | null
  contagem_total: number
}

export interface FiltrosClassificacao {
  busca: string
  tipo: TipoEstoque | null
  classe: string | null
  origem: 'automatico' | 'manual' | null
  situacao: 'A' | 'I' | null
}

export const POR_PAGINA_CLASSIFICACAO = 30

/** Uma página do catálogo com o tipo de cada produto (o catálogo é limitado — página numerada). */
export async function listarClassificacao(
  filtros: FiltrosClassificacao,
  pagina: number,
): Promise<{ linhas: ProdutoClassificado[]; total: number }> {
  const { data, error } = await supabase.rpc('plt_fn_produtos_classificacao', {
    p_busca: filtros.busca.trim() || null,
    p_tipo: filtros.tipo,
    p_classe: filtros.classe,
    p_origem: filtros.origem,
    p_situacao: filtros.situacao,
    p_limite: POR_PAGINA_CLASSIFICACAO,
    p_deslocamento: (pagina - 1) * POR_PAGINA_CLASSIFICACAO,
  })
  if (error) throw new Error(`Não deu para carregar os produtos: ${error.message}`)
  const linhas = (data ?? []) as ProdutoClassificado[]
  return { linhas, total: Number(linhas[0]?.contagem_total ?? 0) }
}

/** O admin define o tipo (ou volta ao automático, com `null`); devolve o tipo que passou a valer. */
export async function definirTipoProduto(tinyId: number, tipo: TipoEstoque | null): Promise<TipoEstoque> {
  const { data, error } = await supabase.rpc('plt_fn_produto_definir_tipo', {
    p_tiny_id: tinyId,
    p_tipo: tipo,
  })
  if (error) throw new Error(error.message)
  return data as TipoEstoque
}
