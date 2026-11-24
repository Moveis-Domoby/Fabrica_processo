// ============================================================================
// SESSAO-57 (frente 3 — pedido do dono, 24/11): a lista para a logística.
// Quantos pedidos programados de HOJE EM DIANTE estão com o pino a conferir:
//   - o ponto ainda é o APROXIMADO (a rua não foi achada: o centro da cidade);
//   - o ponto foi marcado À MÃO exatamente no ponto aproximado de uma cidade
//     (salvaram "marcar à mão" sem arrastar — o 13840 de 24/11).
// Conta só na tela, com o que a leitura de "Já programadas" já traz (o ponto e
// de onde ele veio) — nenhuma leitura a mais. O "ponto aproximado da cidade" é
// o dos pedidos aproximados que a própria lista trouxe (a busca devolve o mesmo
// ponto para todo endereço da mesma cidade). Nenhum acerto automático.
// ============================================================================

export interface PedidoComPino {
  card_id: number
  programacao_data: string
  latitude: number | null
  longitude: number | null
  geo_resolvido: boolean | null
  geo_manual?: boolean
  geo_aproximado?: string | null
}

/** O mesmo ponto do mapa (6 casas: ~10 cm — o que a busca grava volta idêntico). */
const chaveDoPonto = (lat: number, lon: number) => `${lat.toFixed(6)},${lon.toFixed(6)}`

const temPonto = (p: PedidoComPino): p is PedidoComPino & { latitude: number; longitude: number } =>
  p.geo_resolvido === true && p.latitude !== null && p.longitude !== null

/** O ponto ainda é o aproximado da busca (não foi marcado à mão). */
export const pontoAproximado = (p: PedidoComPino) => temPonto(p) && !!p.geo_aproximado && !p.geo_manual

/**
 * Os pedidos com o pino a conferir: o `card_id` de cada um e, à parte, os
 * marcados à mão no ponto aproximado (o cartão avisa diferente). `hoje` =
 * 'AAAA-MM-DD' (o dia da fábrica): o programado para antes de hoje não conta.
 */
export function pinosAConferir(
  pedidos: PedidoComPino[],
  hoje: string,
): { aConferir: Set<number>; noCentro: Set<number> } {
  const aproximados = new Set<string>()
  for (const p of pedidos) {
    if (pontoAproximado(p)) aproximados.add(chaveDoPonto(p.latitude!, p.longitude!))
  }
  const aConferir = new Set<number>()
  const noCentro = new Set<number>()
  for (const p of pedidos) {
    if (p.programacao_data < hoje || !temPonto(p)) continue
    if (pontoAproximado(p)) aConferir.add(p.card_id)
    else if (p.geo_manual && aproximados.has(chaveDoPonto(p.latitude, p.longitude))) {
      aConferir.add(p.card_id)
      noCentro.add(p.card_id)
    }
  }
  return { aConferir, noCentro }
}

/** "1 pedido com o pino a conferir" / "3 pedidos com o pino a conferir". */
export function textoPinosAConferir(n: number): string {
  return `${n} ${n === 1 ? 'pedido' : 'pedidos'} com o pino a conferir`
}
