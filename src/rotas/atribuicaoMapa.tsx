/**
 * SESSAO-56 (frente 4): a atribuição dos mapas. O fundo é do OpenStreetMap
 * (como sempre) e os pontos achados pela busca de endereço vêm da Geoapify —
 * o plano gratuito pede "Powered by Geoapify" perto do mapa e da busca.
 * Um lugar só: os três mapas (Programação, pino da parada/do pedido e o
 * mini-mapa das Entregas do dia) usam o mesmo texto.
 */
export const ATRIBUICAO_MAPA =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a>'

/** A mesma atribuição ao lado da busca de endereço (o "Achar no mapa" das janelas). */
export function AtribuicaoBusca() {
  return (
    <p className="text-[11px] leading-tight text-texto-fraco">
      Busca de endereço:{' '}
      <a
        href="https://www.geoapify.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-texto"
      >
        Powered by Geoapify
      </a>
    </p>
  )
}
