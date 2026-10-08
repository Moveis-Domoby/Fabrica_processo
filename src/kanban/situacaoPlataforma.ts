import type { AcaoAjustePedido } from './api'
import type { SituacaoPlataforma } from './tipos'

/**
 * SESSAO-30 (D-117): onde o pedido está NA PLATAFORMA, em língua de gente — a
 * situação do Tiny é a bolinha ao lado; esta é a nossa.
 */
export const ROTULO_SITUACAO_PLATAFORMA: Record<SituacaoPlataforma, string> = {
  sem_card: 'Fora da plataforma',
  pcp: 'No PCP',
  producao: 'Em produção',
  aguardo: 'Pronto no aguardo',
  em_rota: 'Em rota',
  entregue: 'Entregue',
  arquivado: 'Arquivado',
}

/** O que cada ajuste do super admin faz — o texto da confirmação. */
export const AJUSTES_PEDIDO: { valor: AcaoAjustePedido; rotulo: string; explica: string }[] = [
  {
    valor: 'concluido',
    rotulo: 'Concluído',
    explica:
      'As peças ficam prontas e o pedido vai para Pedidos em aguardo — a que estava em produção vai até lá, a que faltava nasce pronta.',
  },
  {
    valor: 'em_rota',
    rotulo: 'Em rota',
    explica: 'O pedido fica pronto e é lançado para as ROTAS — aparece na Programação.',
  },
  {
    valor: 'entregue',
    rotulo: 'Entregue',
    explica: 'Fecha tudo do pedido na plataforma: as peças saem de todas as contas e ficam no histórico.',
  },
]

/** O total da lista com teto (a porta conta até 10.000). */
export function textoDoTotal(total: number | null | undefined): string {
  if (total === null || total === undefined) return ''
  if (total > 10_000) return 'mais de 10.000'
  return total.toLocaleString('pt-BR')
}

/** "1 pedido" / "N pedidos" — plural por extenso (E-52). */
export function pedidosPorExtenso(n: number): string {
  return n === 1 ? '1 pedido' : `${n.toLocaleString('pt-BR')} pedidos`
}
