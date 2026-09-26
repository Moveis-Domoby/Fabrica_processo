import type { Card, PedidoResumo } from './tipos'

/**
 * De onde a peça veio, em língua do galpão (SESSAO-25): o pedido do Tiny, ou a
 * REPOSIÇÃO de estoque — o card que o estoque gera no PCP quando um produto
 * fica abaixo do mínimo. A reposição não tem pedido: a peça pronta fica livre
 * no estoque aguardando a venda.
 */
export function rotuloOrigemCard(
  card: Pick<Card, 'pedido_id'>,
  pedido?: Pick<PedidoResumo, 'numero'> | null,
): string {
  if (card.pedido_id === null) return 'Reposição de estoque'
  return `Pedido ${pedido?.numero ?? '…'}`
}

/** Card ou unidade sem pedido do Tiny = reposição de estoque (SESSAO-25). */
export function ehDaReposicao(card: Pick<Card, 'tipo' | 'pedido_id'>): boolean {
  return card.tipo === 'reposicao' || card.pedido_id === null
}
