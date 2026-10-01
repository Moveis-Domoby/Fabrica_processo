/**
 * A situação do pedido como o Tiny GRAVA no banco é a DESCRIÇÃO ("Cancelado",
 * "Não entregue", "Preparando envio"), não o código v2 — achado de 08/09
 * (SESSAO-15). Todo teste de situação no front passa por aqui, espelhando
 * plt_privado.fn_situacao_normalizada do banco.
 */
export function situacaoNormalizada(situacao: string | null | undefined): string {
  return (situacao ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '_')
}

export function pedidoCancelado(situacao: string | null | undefined): boolean {
  return situacaoNormalizada(situacao) === 'cancelado'
}

export function pedidoEntregue(situacao: string | null | undefined): boolean {
  return situacaoNormalizada(situacao) === 'entregue'
}

/**
 * A bolinha de cor da situação do Tiny (rodada do dono, 30/09) — classe
 * COMPLETA por situação (A-07: nada de montar classe). A cor nunca vem
 * sozinha: o texto da situação fica sempre ao lado (M-12).
 */
export function corDaSituacao(situacao: string | null | undefined): string {
  switch (situacaoNormalizada(situacao)) {
    case 'em_aberto':
      return 'bg-grafite-400'
    case 'aprovado':
      return 'bg-acao-ativa'
    case 'preparando_envio':
      return 'bg-atencao-forte'
    case 'faturado':
    case 'pronto_para_envio':
      return 'bg-perfeito-forte'
    case 'enviado':
      return 'bg-grafite-600'
    case 'entregue':
      return 'bg-perfeito-forte'
    case 'nao_entregue':
    case 'cancelado':
      return 'bg-danificado-forte'
    default:
      return 'bg-grafite-400'
  }
}
