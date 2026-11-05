import { memo, type MouseEvent, type ReactNode } from 'react'
import { MapPin, MapPinCheck, MapPinOff, Package } from 'lucide-react'
import { dataLegivel, enderecoLegivel, origemAproximada } from './api'
import type { EstadoPedido, ItemPedido, PontoAproximado } from './api'
import { SeloEstado } from './SeloEstado'

export interface DadosCartaoPedido {
  numero: number
  cliente_nome: string
  endereco: string | null
  numero_endereco: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  total_unidades: number
  itens: ItemPedido[]
  data_prevista: string | null
  geo_chave: string | null
  geo_resolvido: boolean | null
  /** SESSAO-45: o ponto foi marcado à mão pela logística. */
  geo_manual?: boolean
  /** SESSAO-45 · ajuste: a rua não foi achada — o ponto veio do CEP, do bairro ou da cidade. */
  geo_aproximado?: PontoAproximado | null
  /** SESSAO-38 (D-156): pronto, em produção ou ainda no PCP. */
  estado?: EstadoPedido | null
  unidades_prontas?: number
}

/**
 * O pedido na Programação (D-111): número, previsão, cliente, endereço e
 * SEMPRE os móveis com a quantidade — "se eu não sei quantos itens vão no
 * caminhão, não faz sentido montar um caminhão". O frete nunca aparece (D-63).
 * `selo` (sugestão, distância…) é da tela que usa o cartão. ↪️ SESSAO-38
 * (D-156): o cartão diz se o pedido está pronto, em produção ou ainda no PCP —
 * agora todos entram na rota.
 */
export const CartaoPedido = memo(function CartaoPedido({
  pedido,
  selo,
  aoMarcarNoMapa,
}: {
  pedido: DadosCartaoPedido
  selo?: ReactNode
  /**
   * SESSAO-45 (pedido do dono): abre a janela de marcar/acertar o ponto do
   * endereço no mapa — só a logística (quem vê a Programação) recebe.
   */
  aoMarcarNoMapa?: () => void
}) {
  const marcar = aoMarcarNoMapa
    ? (e: MouseEvent<HTMLButtonElement>) => {
        // o cartão mora dentro do rótulo da seleção (aba Programar): o toque não marca o pedido
        e.preventDefault()
        e.stopPropagation()
        aoMarcarNoMapa()
      }
    : undefined
  const itens = pedido.itens ?? []
  // ajuste do dono (05/11): a rua não achada vira ponto aproximado (CEP, bairro ou cidade), nunca "não encontrado"
  const aproximado = pedido.geo_manual ? null : (pedido.geo_aproximado ?? null)
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-semibold text-texto tabular-nums">Pedido {pedido.numero}</span>
        <SeloEstado
          estado={pedido.estado}
          prontas={pedido.unidades_prontas}
          total={pedido.total_unidades}
        />
        <span className="text-sm text-texto-suave tabular-nums">
          {pedido.total_unidades} {pedido.total_unidades === 1 ? 'peça' : 'peças'} · previsão{' '}
          {dataLegivel(pedido.data_prevista)}
        </span>
        {selo}
      </span>
      <span className="truncate text-sm text-texto">{pedido.cliente_nome || 'Sem cliente'}</span>
      <span className="text-sm text-texto-suave">{enderecoLegivel(pedido)}</span>
      {itens.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-0.5 border-l-2 border-borda pl-2" aria-label={`Itens do pedido ${pedido.numero}`}>
          {itens.map((item, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-texto">
              <Package aria-hidden className="mt-0.5 size-3.5 shrink-0 text-texto-suave" />
              <span className="tabular-nums">
                <strong>{item.quantidade}×</strong> {item.descricao}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-xs text-texto-fraco">Sem móveis no pedido (só frete ou serviço)</span>
      )}
      {pedido.geo_resolvido === false && (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-atencao-texto">
          <span className="inline-flex items-center gap-1">
            <MapPinOff aria-hidden className="size-3.5 shrink-0" />
            {!pedido.endereco?.trim() && !pedido.cidade?.trim()
              ? 'Endereço incompleto no cadastro (sem rua e sem cidade) — complete no Tiny'
              : 'Ainda sem ponto no mapa da rota — o Google Maps vai pelo endereço'}
          </span>
          {marcar && (
            <button
              type="button"
              onClick={marcar}
              className="inline-flex min-h-toque-md items-center gap-1 rounded-dm border border-atencao-borda bg-atencao-fundo px-2.5 font-semibold text-atencao-texto hover:brightness-95"
            >
              <MapPin aria-hidden className="size-3.5" />
              Marcar no mapa
            </button>
          )}
        </span>
      )}
      {pedido.geo_resolvido === true && aproximado && !marcar && (
        <span className="inline-flex items-center gap-1 text-xs text-texto-suave">
          <MapPin aria-hidden className="size-3.5 shrink-0" />
          Ponto aproximado no mapa ({origemAproximada(aproximado)})
        </span>
      )}
      {pedido.geo_resolvido === true && marcar && (
        <button
          type="button"
          onClick={marcar}
          className="inline-flex min-h-toque-md items-center gap-1 self-start text-left text-xs font-medium text-texto-suave underline-offset-2 hover:text-texto hover:underline"
          title={
            pedido.geo_manual
              ? 'O ponto foi marcado à mão — ele mostra a parada no mapa da rota; o Google Maps e o Waze vão pelo endereço do cliente'
              : aproximado
                ? 'A busca não achou a rua: o ponto é aproximado. O Google Maps e o Waze vão pelo endereço do cliente — acerte aqui só para o mapa da rota'
                : 'O ponto veio da busca automática — se estiver no lugar errado, acerte aqui (o Google Maps e o Waze vão pelo endereço do cliente)'
          }
        >
          {pedido.geo_manual ? (
            <MapPinCheck aria-hidden className="size-3.5 shrink-0 text-perfeito-forte" />
          ) : (
            <MapPin aria-hidden className="size-3.5 shrink-0" />
          )}
          {pedido.geo_manual
            ? 'Ponto marcado à mão · acertar'
            : aproximado
              ? `Ponto aproximado no mapa (${origemAproximada(aproximado)}) · acertar`
              : 'Acertar o ponto no mapa'}
        </button>
      )}
      {pedido.geo_resolvido === null && pedido.geo_chave && (
        <span className="text-xs text-texto-fraco">procurando no mapa…</span>
      )}
      {!pedido.geo_chave && (
        <span className="inline-flex items-center gap-1 text-xs text-atencao-texto">
          <MapPinOff aria-hidden className="size-3.5" />
          Sem endereço cadastrado
        </span>
      )}
    </span>
  )
})

