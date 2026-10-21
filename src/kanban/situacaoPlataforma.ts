import type { AcaoAjustePedido, DestinoConclusao } from './api'
import type { SituacaoPlataforma } from './tipos'

/**
 * SESSAO-30 (D-117): onde o pedido está NA PLATAFORMA, em língua de gente — a
 * situação do Tiny é a bolinha ao lado; esta é a nossa.
 */
export const ROTULO_SITUACAO_PLATAFORMA: Record<SituacaoPlataforma, string> = {
  sem_card: 'Fora da plataforma',
  pcp: 'No PCP',
  producao: 'Em produção',
  aguardo: 'Pronto na Expedição',
  em_rota: 'Em rota',
  entregue: 'Entregue',
  arquivado: 'Arquivado',
  devolvido: 'Em decisão pós devolução',
  // ↩️ 14/10 (D-132/D-134): o Tiny levou adiante sem nada liberado; e o cancelado.
  tiny: 'Segue no Tiny',
  cancelado: 'Cancelado',
}

/** O que cada ajuste do super admin faz — o texto da confirmação. */
export const AJUSTES_PEDIDO: { valor: AcaoAjustePedido; rotulo: string; explica: string }[] = [
  {
    valor: 'concluido',
    rotulo: 'Concluído',
    explica:
      'As peças ficam prontas e o pedido vai para a Expedição — a que estava em produção vai até lá, a que faltava nasce pronta.',
  },
  {
    valor: 'em_rota',
    rotulo: 'Em rota',
    explica: 'O pedido fica pronto e é lançado para as ROTAS — aparece na Programação.',
  },
  {
    valor: 'entregue',
    rotulo: 'Entregue',
    explica:
      'Fecha tudo do pedido na plataforma: as peças saem de todas as contas e ficam no histórico.',
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

/** A frase de quando a peça se conclui — diz para onde ela foi (D-127/D-130). */
export function textoPecaConcluida(destino: DestinoConclusao | null | undefined): string {
  switch (destino) {
    case 'estoque':
      return 'Peça concluída — está no ESTOQUE, sem dono, aguardando a venda'
    case 'terceirizado':
      return 'Ajuste concluído — a peça foi para o terceirizado'
    case 'loja':
      return 'Ajuste concluído — a peça foi para o estoque da loja'
    case 'danificados':
      return 'Ajuste concluído — a peça foi para DANIFICADO'
    default:
      return 'Peça concluída — está na Expedição'
  }
}
