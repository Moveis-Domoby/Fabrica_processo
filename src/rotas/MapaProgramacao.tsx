import { useEffect, useState } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import { latLngBounds } from 'leaflet'
import { Maximize2, Minimize2 } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { Botao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import type { PedidoProgramacao } from './api'
import type { RotaSugerida, Sugestao } from './proximidade'
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

/** O Leaflet não percebe sozinho que o contêiner mudou de tamanho (expandir/recolher). */
function Redimensionar({ expandido }: { expandido: boolean }) {
  const mapa = useMap()
  useEffect(() => {
    const timer = setTimeout(() => mapa.invalidateSize(), 60)
    return () => clearTimeout(timer)
  }, [mapa, expandido])
  return null
}

/**
 * O mapa lateral da programação (D-39): Leaflet + tiles do OpenStreetMap
 * (gratuito, sem chave, com a atribuição obrigatória). A rota sugerida liga
 * os selecionados na ordem de parada (vizinho mais perto, linha reta — não é
 * trânsito), com o número da parada em cada marcador; sugeridos em âmbar,
 * clique num sugerido o adiciona. Marcadores são círculos desenhados (sem
 * imagem) — nada depende de asset externo. O botão Expandir abre em tela
 * cheia (pedido do dono na revisão).
 */
export function MapaProgramacao({
  rota,
  sugestoes,
  aoEscolherSugestao,
}: {
  rota: RotaSugerida<PedidoProgramacao>
  sugestoes: Sugestao<PedidoProgramacao>[]
  aoEscolherSugestao: (pedido: PedidoProgramacao) => void
}) {
  const [expandido, setExpandido] = useState(false)

  // ESC recolhe o mapa expandido.
  useEffect(() => {
    if (!expandido) return
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandido(false)
    }
    window.addEventListener('keydown', aoTecla)
    return () => window.removeEventListener('keydown', aoTecla)
  }, [expandido])

  const paradas = rota.paradas
  const pontos: [number, number][] = [
    ...paradas.map((p) => [p.latitude, p.longitude] as [number, number]),
    ...sugestoes
      .filter((s) => temPonto(s.item))
      .map((s) => [s.item.latitude!, s.item.longitude!] as [number, number]),
  ]

  return (
    <div
      className={cn(
        'relative overflow-hidden border border-borda bg-superficie',
        expandido
          ? 'fixed inset-0 z-[60] rounded-none'
          : 'h-[24rem] rounded-dm-lg lg:h-full lg:min-h-[32rem]',
      )}
    >
      <div className="absolute top-2 right-2 z-[1000] flex items-center gap-2">
        {paradas.length > 1 && (
          <span className="rounded-dm bg-superficie/95 px-2.5 py-1 text-xs font-medium text-texto shadow tabular-nums">
            {paradas.length} paradas · {formatarDistancia(rota.distanciaKm)} em linha reta
          </span>
        )}
        <Botao
          variante="secundaria"
          tamanho="sm"
          icone={expandido ? <Minimize2 /> : <Maximize2 />}
          onClick={() => setExpandido((v) => !v)}
          aria-label={expandido ? 'Recolher o mapa' : 'Expandir o mapa'}
          className="shadow"
        >
          {expandido ? 'Recolher' : 'Expandir'}
        </Botao>
      </div>

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
        <Redimensionar expandido={expandido} />

        {/* A rota sugerida: paradas ligadas na ordem calculada. */}
        {paradas.length > 1 && (
          <Polyline
            positions={paradas.map((p) => [p.latitude, p.longitude] as [number, number])}
            pathOptions={{ color: '#5A585C', weight: 3, opacity: 0.85 }}
          />
        )}

        {paradas.map((p, indice) => (
          <CircleMarker
            key={`sel-${p.card_id}`}
            center={[p.latitude, p.longitude]}
            radius={12}
            pathOptions={{ color: '#5A585C', fillColor: '#F1C24B', fillOpacity: 1, weight: 2 }}
          >
            <Tooltip permanent direction="center" className="plt-parada" opacity={1}>
              {indice + 1}
            </Tooltip>
            <Popup>
              <strong>
                {indice + 1}ª parada · Pedido {p.numero}
              </strong>
              <br />
              {p.cliente_nome}
              <br />
              {p.total_unidades} unidade(s)
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
                <br />a {formatarDistancia(distanciaKm)} da rota — clique para incluir
              </Popup>
            </CircleMarker>
          ) : null,
        )}
      </MapContainer>
    </div>
  )
}
