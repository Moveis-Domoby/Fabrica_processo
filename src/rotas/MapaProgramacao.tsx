import { useEffect, useRef, useState } from 'react'
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
import type { Ponto, Sugestao } from './proximidade'
import { formatarDistancia, temPonto } from './proximidade'
import { FABRICA } from './rotaRuas'

/**
 * Enquadra o mapa nos pontos visíveis quando o CONJUNTO muda — reordenar
 * paradas, recarregar a lista a cada 30 s ou a rota chegar não tiram o mapa de
 * onde a pessoa o deixou.
 */
function Enquadrar({ pontos }: { pontos: [number, number][] }) {
  const mapa = useMap()
  const ultimo = useRef('')
  useEffect(() => {
    const conjunto = pontos
      .map((p) => p.join(','))
      .sort()
      .join(';')
    if (conjunto === ultimo.current) return
    ultimo.current = conjunto
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

export interface ParadaNoMapa {
  parada: PedidoProgramacao & Ponto
  /** A posição da parada na rota (a mesma da lista). */
  numero: number
}

const PONTO_FABRICA: [number, number] = [FABRICA.latitude, FABRICA.longitude]

/**
 * O mapa lateral da programação (D-39 → D-108): Leaflet + tiles do
 * OpenStreetMap (gratuito, sem chave, com a atribuição obrigatória). A rota
 * parte da FÁBRICA (marcador grafite com "F") e volta para ela; a linha é a
 * rota pelas ruas que o serviço de rotas devolveu. Sem ela (calculando, ou o
 * serviço fora do ar), a linha reta tracejada liga fábrica → paradas → fábrica
 * — a tela nunca morre. Paradas numeradas em amarelo (o número é o da lista),
 * sugestões em âmbar (clique inclui). Marcadores são círculos desenhados — nada
 * depende de imagem externa. Expandir abre em tela cheia; ESC recolhe.
 */
export function MapaProgramacao({
  paradas,
  linha,
  resumo,
  sugestoes = [],
  aoEscolherSugestao,
}: {
  paradas: ParadaNoMapa[]
  /** A rota pelas ruas, ou null para a linha reta tracejada. */
  linha: [number, number][] | null
  resumo: string | null
  sugestoes?: Sugestao<PedidoProgramacao>[]
  aoEscolherSugestao?: (pedido: PedidoProgramacao) => void
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

  const pontosParadas = paradas.map(({ parada }) => [parada.latitude, parada.longitude] as [number, number])
  const pontos: [number, number][] = [
    PONTO_FABRICA,
    ...pontosParadas,
    ...sugestoes
      .filter((s) => temPonto(s.item))
      .map((s) => [s.item.latitude!, s.item.longitude!] as [number, number]),
  ]
  const linhaReta: [number, number][] =
    pontosParadas.length > 0 ? [PONTO_FABRICA, ...pontosParadas, PONTO_FABRICA] : []

  return (
    <div
      className={cn(
        'relative overflow-hidden border border-borda bg-superficie',
        expandido
          ? 'fixed inset-0 z-[60] rounded-none'
          : 'h-[24rem] rounded-dm-lg lg:h-[32rem]',
      )}
    >
      <div className="absolute top-2 right-2 z-[1000] flex max-w-[calc(100%-1rem)] flex-wrap items-center justify-end gap-2">
        {resumo && (
          <span className="rounded-dm bg-superficie/95 px-2.5 py-1 text-xs font-medium text-texto shadow tabular-nums">
            {resumo}
          </span>
        )}
        <Botao
          variante="secundaria"
          icone={expandido ? <Minimize2 /> : <Maximize2 />}
          onClick={() => setExpandido((v) => !v)}
          aria-label={expandido ? 'Recolher o mapa' : 'Expandir o mapa'}
          className="shadow"
        >
          {expandido ? 'Recolher' : 'Expandir'}
        </Botao>
      </div>

      <MapContainer
        center={PONTO_FABRICA}
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

        {/* A rota: pelas ruas quando há; senão, linha reta tracejada. */}
        {linha && linha.length > 1 ? (
          <Polyline positions={linha} pathOptions={{ color: '#5A585C', weight: 4, opacity: 0.85 }} />
        ) : (
          linhaReta.length > 1 && (
            <Polyline
              positions={linhaReta}
              pathOptions={{ color: '#5A585C', weight: 3, opacity: 0.7, dashArray: '6 8' }}
            />
          )
        )}

        <CircleMarker
          center={PONTO_FABRICA}
          radius={12}
          pathOptions={{ color: '#F1C24B', fillColor: '#2E2C30', fillOpacity: 1, weight: 2 }}
        >
          <Tooltip permanent direction="center" className="plt-fabrica" opacity={1}>
            F
          </Tooltip>
          <Popup>
            <strong>{FABRICA.nome}</strong>
            <br />
            {FABRICA.endereco}
            <br />
            saída e volta da rota
          </Popup>
        </CircleMarker>

        {paradas.map(({ parada: p, numero }) => (
          <CircleMarker
            key={`sel-${p.card_id}`}
            center={[p.latitude, p.longitude]}
            radius={12}
            pathOptions={{ color: '#5A585C', fillColor: '#F1C24B', fillOpacity: 1, weight: 2 }}
          >
            <Tooltip permanent direction="center" className="plt-parada" opacity={1}>
              {numero}
            </Tooltip>
            <Popup>
              <strong>
                {numero}ª parada · Pedido {p.numero}
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
              eventHandlers={aoEscolherSugestao ? { click: () => aoEscolherSugestao(item) } : undefined}
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
