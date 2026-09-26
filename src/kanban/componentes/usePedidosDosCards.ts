import { useQuery } from '@tanstack/react-query'
import { pedidosResumo } from '../api'
import type { Card, PedidoResumo } from '../tipos'

/**
 * Resolve número do pedido e nome do cliente para os cards visíveis
 * (via plt_fn_pedidos_kanban — as tabelas da integração não são legíveis
 * pelo navegador). Devolve um mapa pedido_id → resumo. Card da reposição de
 * estoque não tem pedido (SESSAO-25) — fica de fora da consulta.
 */
export function usePedidosDosCards(cards: Card[]) {
  const ids = [
    ...new Set(cards.map((c) => c.pedido_id).filter((id): id is number => id !== null)),
  ].sort((a, b) => a - b)

  return useQuery({
    queryKey: ['pedidos-resumo', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const mapa = new Map<number, PedidoResumo>()
      // A função pagina em 100 — para mais ids que isso, busca em lotes.
      for (let i = 0; i < ids.length; i += 100) {
        const lote = await pedidosResumo({ ids: ids.slice(i, i + 100), limite: 100 })
        for (const p of lote) mapa.set(p.pedido_id, p)
      }
      return mapa
    },
  })
}
