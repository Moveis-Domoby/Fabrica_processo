import { supabase } from '@/lib/supabase'

/**
 * SESSAO-40 (D-188 — a pesquisa do Trello do vídeo do dono, "a
 * rastreabilidade dos cards"): a busca geral acha os cards de TODOS os setores
 * pelo número do pedido (que começa com o texto) ou pelo nome (que contém) e
 * diz onde cada um está. Uma requisição por busca (por cursor — "Ver mais"
 * manda o id do último); só o que a pessoa pode ver (o banco decide).
 */
export interface ItemDaBusca {
  id: number
  tipo: 'pedido' | 'unidade' | 'reposicao' | 'avulso'
  pedido_id: number | null
  pedido_numero: number | null
  /** a situação do pedido no Tiny (rótulo — "Cancelado", "Preparando envio"…) */
  pedido_situacao: string | null
  titulo: string | null
  sku: string | null
  indice: number | null
  total: number | null
  setor_id: number | null
  setor_nome: string | null
  setor_codigo: string | null
  setor_papel: 'entrada' | 'producao' | 'terminal' | null
  etapa_nome: string | null
  desde: string | null
  arquivado_em: string | null
  /** o porquê do arquivamento: entregue · concluido · contagem · venda · baixa_manual · … */
  arquivado_motivo: string | null
  liberado_completo_em: string | null
  standby: boolean
  /** quem está fazendo agora */
  executor: string | null
  /** a rota programada do pedido (enquanto não entregue) */
  rota_dia: string | null
  rota_caminhao: string | null
  rota_numero: number | null
}

export interface PaginaDaBusca {
  itens: ItemDaBusca[]
  tem_mais: boolean
  /** o número do pedido que valeu (nulo = a busca foi pelo nome) */
  numero: number | null
}

export const ITENS_POR_PAGINA = 20

/**
 * O texto que vale a busca (a mesma régua do banco): o número do pedido com 2
 * números ou mais (também "pedido 13721", "#13721"), ou o nome com 3 letras ou
 * mais (o índice de trigramas precisa de 3). Senão, nulo — nada é pedido.
 */
export function termoDaBusca(texto: string): string | null {
  const t = texto.trim()
  if (/^(pedido|ped[.]?|#)? *[0-9]{2,}$/i.test(t)) return t
  return t.replace(/ /g, '').length >= 3 ? t : null
}

export async function buscarCards(
  texto: string,
  depoisId: number | null = null,
  limite = ITENS_POR_PAGINA,
): Promise<PaginaDaBusca> {
  const { data, error } = await supabase.rpc('plt_fn_busca_cards', {
    p_texto: texto,
    p_depois_id: depoisId,
    p_limite: limite,
  })
  if (error) throw new Error(`Não deu para buscar: ${error.message}`)
  const pagina = (data ?? {}) as Partial<PaginaDaBusca>
  return {
    itens: pagina.itens ?? [],
    tem_mais: pagina.tem_mais ?? false,
    numero: pagina.numero ?? null,
  }
}
