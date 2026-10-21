/**
 * SESSAO-38 (ajuste 2 — "pedidos em aguardo agora pertence à Expedição"): o
 * lugar interno onde a peça pronta de pedido espera a entrega continua
 * cadastrado como "PEDIDOS EM AGUARDO" (dado do banco, não muda de nome); na
 * tela ele se chama Expedição.
 */
export function nomeDoLugar(nome: string | null | undefined): string | null {
  if (!nome) return nome ?? null
  return nome.trim().toLowerCase() === 'pedidos em aguardo' ? 'Expedição' : nome
}
