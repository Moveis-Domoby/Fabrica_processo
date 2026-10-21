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

/** Está pronto para entregar? Sem estado (porta antiga), vale como pronto — o banco confere. */
export function prontoParaEntregar(estado: EstadoPedido | null | undefined): boolean {
  return !estado || estado === 'pronto'
}

/**
 * ↩️ SESSAO-38 (ajuste — revisão da D-156, como a D-113): o "Entregue" de um
 * pedido que ainda aparece em produção NÃO se trava (no campo, a plataforma pode
 * estar atrasada) — pede esta confirmação, e confirmada fecha tudo do pedido.
 */
export function fraseEntregaIncompleta(prontas: number, total: number): string {
  const pecas = total === 1 ? 'peça pronta' : 'peças prontas'
  return `Este pedido ainda aparece em produção na fábrica (${prontas} de ${total} ${pecas}). Confirmar a entrega encerra tudo dele.`
}

/** O banco recusou pedindo a confirmação (o estado da tela estava velho)? */
export function pedeConfirmacaoDeEntrega(erro: unknown): boolean {
  return erro instanceof Error && /Confirmar a entrega encerra tudo dele/i.test(erro.message)
}
