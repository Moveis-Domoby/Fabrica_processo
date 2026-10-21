import type { EstadoPedido } from './api'

/**
 * O texto do estado de um pedido na rota (SESSAO-38 · D-156): agora entram
 * pedidos prontos E os ainda em produção ou no PCP — cada cartão diz qual.
 */
export function textoDoEstado(
  estado: EstadoPedido | null | undefined,
  prontas = 0,
  total = 0,
): string | null {
  if (!estado) return null
  if (estado === 'pronto') return 'Pronto'
  if (estado === 'entregue') return 'Entregue'
  if (estado === 'no_pcp') return 'Ainda no PCP'
  // em produção: "Em produção · 1 de 3 prontas"
  if (total > 0 && prontas > 0)
    return `Em produção · ${prontas} de ${total} ${total === 1 ? 'pronta' : 'prontas'}`
  return 'Em produção'
}

/** Pode marcar "Entregue"? Sem estado (porta antiga) não trava — o banco confere. */
export function prontoParaEntregar(estado: EstadoPedido | null | undefined): boolean {
  return !estado || estado === 'pronto'
}
