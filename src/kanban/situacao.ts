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
