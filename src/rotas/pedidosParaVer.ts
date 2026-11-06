import { dataLegivel, enderecoLegivel } from './api'
import type { PedidoProgramacao, PedidoProgramado } from './api'
import { ehAvulsa } from './paradasAvulsas'
import type { ItemAvulsa } from './paradasAvulsas'

/** Uma linha do "Ver pedidos" do mapa expandido: só o essencial. */
export interface PedidoParaVer {
  chave: number
  /** "Pedido 13745" ou "Parada avulsa · Buscar material". */
  titulo: string
  endereco: string
  /** A data de entrega prevista, legível; null = sem data (a parada avulsa). */
  entrega: string | null
}

type Parada = PedidoProgramacao | PedidoProgramado | ItemAvulsa

/**
 * Ajuste do dono (06/11): o "Ver pedidos" do mapa em tela cheia é "curto e
 * enxuto, apenas com os números dos pedidos, endereços e data de entrega" —
 * na ordem da rota.
 */
export function pedidosParaVer(paradas: Parada[]): PedidoParaVer[] {
  return paradas.map((p) =>
    ehAvulsa(p)
      ? {
          chave: p.card_id,
          titulo: `Parada avulsa · ${p.avulsa.titulo}`,
          endereco: p.avulsa.endereco.trim() || 'Sem endereço cadastrado',
          entrega: null,
        }
      : {
          chave: p.card_id,
          titulo: `Pedido ${p.numero}`,
          endereco: enderecoLegivel(p),
          entrega: p.data_prevista ? dataLegivel(p.data_prevista) : null,
        },
  )
}
