import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { Marker as MarcadorLeaflet } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { iconePino } from './iconeAvulsa'

/**
 * Centraliza no ponto quando ele vem de FORA (o endereço achado); o que a
 * própria pessoa moveu (arrasto ou toque) não puxa o mapa. Na janela, o
 * Leaflet mede o contêiner de novo logo depois de aparecer.
 */
function Centralizar({
  latitude,
  longitude,
  ultimoMovido,
}: {
  latitude: number
  longitude: number
  ultimoMovido: RefObject<string>
}) {
  const mapa = useMap()
  useEffect(() => {
    const timer = setTimeout(() => mapa.invalidateSize(), 60)
    return () => clearTimeout(timer)
  }, [mapa])
  useEffect(() => {
    if (ultimoMovido.current === `${latitude},${longitude}`) return
    mapa.setView([latitude, longitude], Math.max(mapa.getZoom(), 16))
  }, [mapa, latitude, longitude, ultimoMovido])
  return null
}

function ToqueMove({ aoMover }: { aoMover: (latitude: number, longitude: number) => void }) {
  useMapEvents({ click: (e) => aoMover(e.latlng.lat, e.latlng.lng) })
  return null
}

/**
 * SESSAO-41 (D-196): o mapinha da janela "Parada avulsa" — o PINO do endereço
 * achado, ARRASTÁVEL (ou toque no mapa) para acertar o lugar exato. Pedaço
 * próprio do pacote: só baixa quando a pessoa pede "Achar no mapa" (Lei §9).
 */
export default function MapaPinoParada({
  latitude,
  longitude,
  aoMover,
}: {
  latitude: number
  longitude: number
  aoMover: (latitude: number, longitude: number) => void
}) {
  const ultimoMovido = useRef('')
  const icone = useMemo(() => iconePino(), [])
  const mover = (lat: number, lon: number) => {
    ultimoMovido.current = `${lat},${lon}`
    aoMover(lat, lon)
  }
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={16}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Centralizar latitude={latitude} longitude={longitude} ultimoMovido={ultimoMovido} />
      <ToqueMove aoMover={mover} />
      <Marker
        position={[latitude, longitude]}
        icon={icone}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const ll = (e.target as MarcadorLeaflet).getLatLng()
            mover(ll.lat, ll.lng)
          },
        }}
      />
    </MapContainer>
  )
}
