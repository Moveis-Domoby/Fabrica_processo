import { useEffect } from 'react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { latLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { PedidoProgramacao } from './api'
import type { Sugestao } from './proximidade'
import { formatarDistancia, temPonto } from './proximidade'

// Natal-RN: onde a fábrica entrega. É só o enquadramento inicial, antes de
// haver ponto para mostrar.
const CENTRO_PADRAO: [number, number] = [-5.795, -35.209]

/** Enquadra o mapa em todos os pontos visíveis sempre que eles mudam. */
function Enquadrar({ pontos }: { pontos: [number, number][] }) {
  const mapa = useMap()
  useEffect(() => {
    if (pontos.length === 0) return
    if (pontos.length === 1) {
      mapa.setView(pontos[0], 14)
      return
    }
    mapa.fitBounds(latLngBounds(pontos), { padding: [32, 32], maxZoom: 15 })
  }, [mapa, pontos])
  return null
}

/**
 * O mapa lateral da programação (D-39): Leaflet + tiles do OpenStreetMap
 * (gratuito, sem chave, com a atribuição obrigatória). Selecionados em
 * amarelo-marca ligados por linha (só para enxergar o conjunto — não é rota
 * calculada); sugeridos em âmbar; clique num sugerido o adiciona. Marcadores
 * são círculos desenhados (sem imagem) — nada depende de asset externo.
 */
export function MapaProgramacao({
  selecionados,
  sugestoes,
  aoEscolherSugestao,
}: {
  selecionados: PedidoProgramacao[]
  sugestoes: Sugestao<PedidoProgramacao>[]
  aoEscolherSugestao: (pedido: PedidoProgramacao) => void
}) {
  const comPonto = selecionados.filter(temPonto)
  const pontos: [number, number][] = [
    ...comPonto.map((p) => [p.latitude, p.longitude] as [number, number]),
    ...sugestoes
      .filter((s) => temPonto(s.item))
      .map((s) => [s.item.latitude!, s.item.longitude!] as [number, number]),
  ]

  return (
    <div className="h-[24rem] overflow-hidden rounded-dm-lg border border-borda lg:h-full lg:min-h-[32rem]">
      <MapContainer
        center={CENTRO_PADRAO}
        zoom={12}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Enquadrar pontos={pontos} />

        {comPonto.length > 1 && (
          <Polyline
            positions={comPonto.map((p) => [p.latitude, p.longitude] as [number, number])}
            pathOptions={{ color: '#5A585C', weight: 2, dashArray: '6 6' }}
          />
        )}

        {comPonto.map((p) => (
          <CircleMarker
            key={`sel-${p.card_id}`}
            center={[p.latitude, p.longitude]}
            radius={10}
            pathOptions={{ color: '#5A585C', fillColor: '#F1C24B', fillOpacity: 1, weight: 2 }}
          >
            <Popup>
              <strong>Pedido {p.numero}</strong>
              <br />
              {p.cliente_nome}
              <br />
              {p.total_unidades} unidade(s) · selecionado
            </Popup>
          </CircleMarker>
        ))}

        {sugestoes.map(({ item, distanciaKm }) =>
          temPonto(item) ? (
            <CircleMarker
              key={`sug-${item.card_id}`}
              center={[item.latitude, item.longitude]}
              radius={8}
              pathOptions={{ color: '#9A5B00', fillColor: '#F59E0B', fillOpacity: 0.9, weight: 2 }}
              eventHandlers={{ click: () => aoEscolherSugestao(item) }}
            >
              <Popup>
                <strong>Pedido {item.numero}</strong> · sugestão
                <br />
                {item.cliente_nome}
                <br />a {formatarDistancia(distanciaKm)} da seleção — clique para incluir
              </Popup>
            </CircleMarker>
          ) : null,
        )}
      </MapContainer>
    </div>
  )
}
