import { memo, type ReactNode } from 'react'
import { MapPinOff, Package } from 'lucide-react'
import { dataLegivel, enderecoLegivel } from './api'
import type { ItemPedido } from './api'

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
}

/**
 * O pedido na Programação (D-111): número, previsão, cliente, endereço e
 * SEMPRE os móveis com a quantidade — "se eu não sei quantos itens vão no
 * caminhão, não faz sentido montar um caminhão". O frete nunca aparece (D-63).
 * `selo` (sugestão, distância…) é da tela que usa o cartão.
 */
export const CartaoPedido = memo(function CartaoPedido({
  pedido,
  selo,
}: {
  pedido: DadosCartaoPedido
  selo?: ReactNode
}) {
  const itens = pedido.itens ?? []
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-semibold text-texto tabular-nums">Pedido {pedido.numero}</span>
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
        <span className="inline-flex items-center gap-1 text-xs text-atencao-texto">
          <MapPinOff aria-hidden className="size-3.5" />
          Endereço não encontrado no mapa — entra na programação, só não plota
        </span>
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

