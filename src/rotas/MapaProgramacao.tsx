import { Fragment, memo, useEffect, useRef, useState } from 'react'
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
import type { Map as LeafletMap } from 'leaflet'
import { Maximize2, Minimize2 } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { Botao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import type { PedidoProgramacao } from './api'
import type { Ponto, Sugestao } from './proximidade'
import { formatarDistancia, temPonto } from './proximidade'
import { FABRICA } from './rotaRuas'

function enquadrar(mapa: LeafletMap, pontos: [number, number][]) {
  if (pontos.length === 0) return
  if (pontos.length === 1) {
    mapa.setView(pontos[0], 14)
    return
  }
  mapa.fitBounds(latLngBounds(pontos), { padding: [32, 32], maxZoom: 15 })
}

/**
 * Enquadra o mapa nos pontos visíveis quando o CONJUNTO muda — reordenar
 * paradas, recarregar a lista a cada 30 s ou a rota chegar não tiram o mapa de
 * onde a pessoa o deixou. Expandir/recolher: o Leaflet não percebe sozinho que
 * o contêiner mudou de tamanho — mede de novo e reenquadra (senão a rota fica
 * cortada no canto do mapa grande).
 */
function Enquadrar({ pontos, expandido }: { pontos: [number, number][]; expandido: boolean }) {
  const mapa = useMap()
  const ultimo = useRef('')
  const pontosAtuais = useRef(pontos)
  useEffect(() => {
    pontosAtuais.current = pontos
    const conjunto = pontos
      .map((p) => p.join(','))
      .sort()
      .join(';')
    if (conjunto === ultimo.current) return
    ultimo.current = conjunto
    enquadrar(mapa, pontos)
  }, [mapa, pontos])
  useEffect(() => {
    const timer = setTimeout(() => {
      mapa.invalidateSize()
      enquadrar(mapa, pontosAtuais.current)
    }, 60)
    return () => clearTimeout(timer)
  }, [mapa, expandido])
  return null
}

/** O que o mapa precisa de uma parada (serve ao pedido sem programação e ao já programado). */
export type ParadaMinima = Pick<PedidoProgramacao, 'card_id' | 'numero' | 'cliente_nome' | 'total_unidades'>

export interface ParadaNoMapa {
  parada: ParadaMinima & Ponto
  /** A posição da parada na rota (a mesma da lista). */
  numero: number
}

export interface RotaNoMapa {
  id: string
  /** A cor da linha (a do caminhão, ou a da rota em montagem). */
  cor: string
  paradas: ParadaNoMapa[]
  /** A rota pelas ruas cortada em trechos (um por perna); null = linha reta tracejada. */
  trechos: [number, number][][] | null
  /** Outro caminhão do mesmo dia: aparece transparente, sem números. */
  esmaecida?: boolean
  /** A linha que está na tela é a de antes — a nova está sendo calculada. */
  recalculando?: boolean
}

const PONTO_FABRICA: [number, number] = [FABRICA.latitude, FABRICA.longitude]

function LinhaDaRota({
  rota,
  trechoSelecionado,
  aoSelecionarTrecho,
}: {
  rota: RotaNoMapa
  trechoSelecionado: number | null
  aoSelecionarTrecho?: (indice: number | null) => void
}) {
  const pontos = rota.paradas.map(({ parada }) => [parada.latitude, parada.longitude] as [number, number])
  if (!rota.trechos || rota.trechos.length === 0) {
    if (pontos.length === 0) return null
    return (
      <Polyline
        key={`reta-${rota.id}`}
        positions={[PONTO_FABRICA, ...pontos, PONTO_FABRICA]}
        pathOptions={{ color: rota.cor, weight: 3, opacity: rota.esmaecida ? 0.25 : 0.8, dashArray: '6 8' }}
      />
    )
  }
  const base = rota.esmaecida ? 0.28 : rota.recalculando ? 0.45 : 0.95
  return (
    <>
      {rota.trechos.map((trecho, i) => {
        const apagado = trechoSelecionado !== null && trechoSelecionado !== i
        const opacidade = apagado ? 0.18 : base
        return (
          // As chaves separam as camadas: o Leaflet MESCLA o estilo novo no
          // antigo (E-83) — cada trecho e o contorno têm camada própria.
          <Fragment key={`${rota.id}-${i}`}>
            {!rota.esmaecida && (
              <Polyline
                positions={trecho}
                pathOptions={{ color: '#FFFFFF', weight: 9, opacity: apagado ? 0.15 : 0.9 }}
                interactive={false}
              />
            )}
            <Polyline
              positions={trecho}
              pathOptions={{ color: rota.cor, weight: rota.esmaecida ? 4 : 5, opacity: opacidade }}
              eventHandlers={
                aoSelecionarTrecho && !rota.esmaecida
                  ? { click: () => aoSelecionarTrecho(trechoSelecionado === i ? null : i) }
                  : undefined
              }
            />
          </Fragment>
        )
      })}
    </>
  )
}

/**
 * O mapa lateral da programação (D-39 → D-108 → ajustes de 03/10, D-111):
 * Leaflet + tiles do OpenStreetMap (gratuito, sem chave, com a atribuição
 * obrigatória). A rota parte da FÁBRICA ("F") e volta para ela, pelas ruas.
 *
 * - **Prioridade visual:** a linha tem a cor da rota (a do caminhão, ou azul na
 *   montagem) com contorno branco — destaca sobre as ruas coloridas do mapa.
 * - **Trecho escolhido:** tocar num trecho (ou escolher no painel) acende só
 *   ele; o resto fica transparente — tocar de novo volta à rota inteira.
 * - **Outros caminhões do dia:** aparecem transparentes, sem números.
 * - **Sem a rota pelas ruas** (calculando, serviço fora): linha reta tracejada.
 *   Enquanto a nova chega, a de antes fica, esmaecida — a tela não "pisca".
 *
 * Só redesenha quando o que mostra muda (memo — a lista ao lado pode mudar à
 * vontade). Marcadores são círculos desenhados — nada depende de imagem externa.
 */
export const MapaProgramacao = memo(function MapaProgramacao({
  rotas,
  trechoSelecionado = null,
  aoSelecionarTrecho,
  resumo,
  sugestoes = SEM_SUGESTOES,
  aoEscolherSugestao,
}: {
  rotas: RotaNoMapa[]
  /** O trecho aceso da rota principal (a 1ª não esmaecida). */
  trechoSelecionado?: number | null
  aoSelecionarTrecho?: (indice: number | null) => void
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

  const principal = rotas.find((r) => !r.esmaecida)
  const pontos: [number, number][] = [
    PONTO_FABRICA,
    ...rotas.flatMap((r) => r.paradas.map(({ parada }) => [parada.latitude, parada.longitude] as [number, number])),
    ...sugestoes
      .filter((s) => temPonto(s.item))
      .map((s) => [s.item.latitude!, s.item.longitude!] as [number, number]),
  ]

  return (
    <div
      className={cn(
        // isolate: as camadas do Leaflet (z-index 400–1000) ficam DENTRO do mapa —
        // sem isso o mapa desenhava por cima da barra fixa do Programar e das bolhas
        'relative isolate overflow-hidden border border-borda bg-superficie',
        expandido ? 'fixed inset-0 z-[60] rounded-none' : 'h-[24rem] rounded-dm-lg lg:h-[32rem]',
      )}
    >
      {/* left-14: o resumo nunca cobre o + / − do zoom (canto esquerdo) em mapa estreito */}
      <div className="pointer-events-none absolute top-2 right-2 left-14 z-[1000] flex flex-wrap items-center justify-end gap-2 [&>*]:pointer-events-auto">
        {resumo && (
          <span
            className="rounded-dm bg-superficie/95 px-2.5 py-1 text-xs font-medium text-texto shadow tabular-nums"
            role="status"
          >
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

      <MapContainer center={PONTO_FABRICA} zoom={12} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Enquadrar pontos={pontos} expandido={expandido} />

        {/* As esmaecidas por baixo; a principal por cima. */}
        {[...rotas]
          .sort((a, b) => Number(!a.esmaecida) - Number(!b.esmaecida))
          .map((rota) => (
            <LinhaDaRota
              key={rota.id}
              rota={rota}
              trechoSelecionado={rota === principal ? trechoSelecionado : null}
              aoSelecionarTrecho={rota === principal ? aoSelecionarTrecho : undefined}
            />
          ))}

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

        {rotas.map((rota) =>
          rota.paradas.map(({ parada: p, numero }) =>
            rota.esmaecida ? (
              <CircleMarker
                key={`esm-${rota.id}-${p.card_id}`}
                center={[p.latitude, p.longitude]}
                radius={6}
                pathOptions={{ color: rota.cor, fillColor: rota.cor, fillOpacity: 0.35, opacity: 0.5, weight: 2 }}
              >
                <Popup>
                  Pedido {p.numero} · outro caminhão
                  <br />
                  {p.cliente_nome}
                </Popup>
              </CircleMarker>
            ) : (
              <CircleMarker
                key={`sel-${rota.id}-${p.card_id}`}
                center={[p.latitude, p.longitude]}
                radius={12}
                pathOptions={{ color: rota.cor, fillColor: '#F1C24B', fillOpacity: 1, weight: 3 }}
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
                  {p.total_unidades} {p.total_unidades === 1 ? 'peça' : 'peças'}
                </Popup>
              </CircleMarker>
            ),
          ),
        )}

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
})

const SEM_SUGESTOES: Sugestao<PedidoProgramacao>[] = []
