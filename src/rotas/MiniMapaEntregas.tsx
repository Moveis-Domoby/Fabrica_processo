import { useEffect } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { latLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { EntregaDoDia } from './api'
import { FABRICA } from './rotaRuas'

type Coord = [number, number]

function Enquadrar({ pontos }: { pontos: Coord[] }) {
  const mapa = useMap()
  const chave = pontos.map((p) => p.join(',')).join(';')
  useEffect(() => {
    if (pontos.length > 0) mapa.fitBounds(latLngBounds(pontos), { padding: [24, 24], maxZoom: 15 })
    // o conjunto de pontos é a chave — não reenquadra a cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, mapa])
  return null
}

/**
 * O mini mapa do entregador (D-115): a fábrica e as paradas do dia na ORDEM da
 * rota (o número da parada), a entregue apagada. Pedaço próprio do pacote —
 * só baixa quando a tela das entregas abre (Lei §9).
 */
export default function MiniMapaEntregas({ entregas }: { entregas: EntregaDoDia[] }) {
  const comPonto = entregas.filter((e) => e.latitude !== null && e.longitude !== null)
  const fabrica: Coord = [FABRICA.latitude, FABRICA.longitude]
  const linha: Coord[] = [fabrica, ...comPonto.map((e) => [e.latitude!, e.longitude!] as Coord)]
  return (
    <MapContainer
      center={fabrica}
      zoom={12}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Enquadrar pontos={linha} />
      <Polyline positions={linha} pathOptions={{ color: '#6b7280', weight: 2, dashArray: '6 6' }} />
      <CircleMarker
        center={fabrica}
        radius={7}
        pathOptions={{ color: '#111827', fillColor: '#111827', fillOpacity: 1 }}
      >
        <Tooltip>{FABRICA.nome}</Tooltip>
      </CircleMarker>
      {comPonto.map((e) => (
        <CircleMarker
          key={e.card_id}
          center={[e.latitude!, e.longitude!]}
          radius={12}
          pathOptions={{
            color: e.entregue_em ? '#9ca3af' : '#1d4ed8',
            fillColor: e.entregue_em ? '#e5e7eb' : '#3b82f6',
            fillOpacity: 0.9,
          }}
        >
          <Tooltip
            permanent
            direction="center"
            className="!border-0 !bg-transparent !p-0 !shadow-none"
          >
            <span
              className={
                e.entregue_em ? 'text-xs font-bold text-gray-500' : 'text-xs font-bold text-white'
              }
            >
              {e.posicao}
            </span>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
