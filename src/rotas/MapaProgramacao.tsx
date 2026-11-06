import { Fragment, memo, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import { latLngBounds } from 'leaflet'
import type { Map as LeafletMap } from 'leaflet'
import { List, Maximize2, Minimize2, X } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { Botao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import type { PedidoProgramacao } from './api'
import type { PedidoParaVer } from './pedidosParaVer'
import type { Ponto, Sugestao } from './proximidade'
import { formatarDistancia, temPonto } from './proximidade'
import { iconeParadaAvulsa } from './iconeAvulsa'
import { FABRICA } from './rotaRuas'
import { OPCOES_TRAJETO, trechosDoTrajeto } from './trechos'
import type { Trajeto } from './trechos'

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
export type ParadaMinima = Pick<
  PedidoProgramacao,
  'card_id' | 'numero' | 'cliente_nome' | 'total_unidades'
>

export interface ParadaNoMapa {
  parada: ParadaMinima & Ponto
  /** A posição da parada na rota (a mesma da lista). */
  numero: number
  /**
   * SESSAO-41 (D-196): é uma PARADA AVULSA (não um pedido) — marcador próprio
   * (quadrado "A"), com o título e o endereço que a pessoa escreveu.
   */
  avulsa?: { titulo: string; endereco: string }
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

function LinhaDaRota({ rota, trajeto }: { rota: RotaNoMapa; trajeto: Trajeto }) {
  const pontos = rota.paradas.map(
    ({ parada }) => [parada.latitude, parada.longitude] as [number, number],
  )
  if (!rota.trechos || rota.trechos.length === 0) {
    if (pontos.length === 0) return null
    // Linha reta (serviço fora ou calculando): a ida é fábrica → … → última
    // parada; a volta, a última parada → fábrica.
    const ultimo = pontos[pontos.length - 1]
    const posicoes =
      trajeto === 'ida'
        ? [PONTO_FABRICA, ...pontos]
        : trajeto === 'volta'
          ? [ultimo, PONTO_FABRICA]
          : [PONTO_FABRICA, ...pontos, PONTO_FABRICA]
    return (
      <Polyline
        key={`reta-${rota.id}-${trajeto}`}
        positions={posicoes}
        pathOptions={{
          color: rota.cor,
          weight: 3,
          opacity: rota.esmaecida ? 0.25 : 0.8,
          dashArray: '6 8',
        }}
      />
    )
  }
  const base = rota.esmaecida ? 0.28 : rota.recalculando ? 0.45 : 0.95
  // SESSAO-38: só a ida ou só a volta = o resto da rota NÃO se desenha (o mapa
  // não fica poluído pela linha da volta). A linha de antes (recalculando, um
  // pedaço só) aparece inteira.
  const visiveis = new Set(
    rota.trechos.length > 1 ? trechosDoTrajeto(rota.trechos.length, trajeto) : [0],
  )
  return (
    <>
      {rota.trechos.map((trecho, i) => {
        if (!visiveis.has(i)) return null
        return (
          // As chaves separam as camadas: o Leaflet MESCLA o estilo novo no
          // antigo (E-83) — cada trecho e o contorno têm camada própria.
          <Fragment key={`${rota.id}-${i}`}>
            {!rota.esmaecida && (
              <Polyline
                positions={trecho}
                pathOptions={{ color: '#FFFFFF', weight: 9, opacity: 0.9 }}
                interactive={false}
              />
            )}
            <Polyline
              positions={trecho}
              pathOptions={{ color: rota.cor, weight: rota.esmaecida ? 4 : 5, opacity: base }}
              interactive={false}
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
 * - **Ida e volta (SESSAO-38, ↩️ o trecho aceso):** os botões "Rota inteira ·
 *   Só a ida · Só a volta" desenham só a parte escolhida — a ida vai da
 *   fábrica à última parada, a volta da última parada à fábrica.
 * - **Outros caminhões do dia:** aparecem transparentes, sem números.
 * - **Sem a rota pelas ruas** (calculando, serviço fora): linha reta tracejada.
 *   Enquanto a nova chega, a de antes fica, esmaecida — a tela não "pisca".
 * - **↩️ Tela cheia (ajuste do dono de 06/11):** expandir abre uma camada que
 *   cobre TUDO (barra lateral, barra de cima, botões flutuantes, a barra de
 *   baixo do Programar) com só dois botões: "Recolher o mapa" e "Ver pedidos"
 *   (a lista curta: nº, endereço e data de entrega). Antes o mapa ficava
 *   `fixed` dentro da página — o `@container` da aba vira o "chão" do `fixed` e
 *   ele não cobria a tela (o recolher sumia atrás da barra de cima). O Leaflet
 *   vive num nó próprio que MUDA DE CASA (página ↔ camada) sem ser recriado:
 *   zoom, centro e camadas seguem iguais.
 *
 * Só redesenha quando o que mostra muda (memo — a lista ao lado pode mudar à
 * vontade). Marcadores são círculos desenhados — nada depende de imagem externa.
 */
export const MapaProgramacao = memo(function MapaProgramacao({
  rotas,
  trajeto = 'inteira',
  aoMudarTrajeto,
  resumo,
  sugestoes = SEM_SUGESTOES,
  aoEscolherSugestao,
  paradasParaVer = SEM_PEDIDOS,
  classeAltura = 'h-[24rem] lg:h-[32rem]',
}: {
  rotas: RotaNoMapa[]
  /** O trajeto da rota principal (a 1ª não esmaecida): inteira, só a ida ou só a volta. */
  trajeto?: Trajeto
  aoMudarTrajeto?: (trajeto: Trajeto) => void
  resumo: string | null
  sugestoes?: Sugestao<PedidoProgramacao>[]
  aoEscolherSugestao?: (pedido: PedidoProgramacao) => void
  /** O "Ver pedidos" da tela cheia — a rota na ordem (nº, endereço, data de entrega). */
  paradasParaVer?: PedidoParaVer[]
  /** A altura do mapa na página (a tela cheia ocupa tudo). */
  classeAltura?: string
}) {
  const [expandido, setExpandido] = useState(false)
  const [vendoPedidos, setVendoPedidos] = useState(false)
  const idLista = useId()
  // O nó do Leaflet: fora do React (o React desenha DENTRO dele por portal) e
  // pendurado ora no lugar da página, ora na camada da tela cheia.
  const [casaDoMapa] = useState(() => {
    const no = document.createElement('div')
    no.style.position = 'absolute'
    no.style.inset = '0'
    return no
  })
  const [lugarNaPagina, setLugarNaPagina] = useState<HTMLDivElement | null>(null)
  const [lugarNaCamada, setLugarNaCamada] = useState<HTMLDivElement | null>(null)
  const botaoExpandir = useRef<HTMLButtonElement>(null)
  const botaoRecolher = useRef<HTMLButtonElement>(null)
  const botaoVer = useRef<HTMLButtonElement>(null)
  const painelVer = useRef<HTMLDivElement>(null)
  const jaExpandiu = useRef(false)

  useLayoutEffect(() => {
    const destino = expandido ? lugarNaCamada : lugarNaPagina
    if (destino && casaDoMapa.parentNode !== destino) destino.appendChild(casaDoMapa)
  }, [casaDoMapa, expandido, lugarNaPagina, lugarNaCamada])

  // Tela cheia: a página por baixo não rola; o foco vai ao "Recolher o mapa" e,
  // ao recolher, volta ao "Expandir".
  useEffect(() => {
    if (!expandido) {
      if (jaExpandiu.current) botaoExpandir.current?.focus()
      return
    }
    jaExpandiu.current = true
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    botaoRecolher.current?.focus()
    return () => {
      document.body.style.overflow = antes
    }
  }, [expandido])

  // ESC: fecha a lista; sem lista aberta, recolhe o mapa.
  useEffect(() => {
    if (!expandido) return
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      if (vendoPedidos) {
        setVendoPedidos(false)
        botaoVer.current?.focus()
      } else {
        setExpandido(false)
      }
    }
    window.addEventListener('keydown', aoTecla, true)
    return () => window.removeEventListener('keydown', aoTecla, true)
  }, [expandido, vendoPedidos])

  // A lista fecha com um toque fora dela (no mapa, inclusive).
  useEffect(() => {
    if (!vendoPedidos) return
    const aoTocar = (e: PointerEvent) => {
      const alvo = e.target
      if (alvo instanceof Node) {
        if (painelVer.current?.contains(alvo)) return
        if (botaoVer.current?.contains(alvo)) return
      }
      setVendoPedidos(false)
    }
    window.addEventListener('pointerdown', aoTocar, true)
    return () => window.removeEventListener('pointerdown', aoTocar, true)
  }, [vendoPedidos])

  function recolher() {
    setVendoPedidos(false)
    setExpandido(false)
  }

  const principal = rotas.find((r) => !r.esmaecida)
  const temRota = (principal?.paradas.length ?? 0) > 0
  const pontos: [number, number][] = [
    PONTO_FABRICA,
    ...rotas.flatMap((r) =>
      r.paradas.map(({ parada }) => [parada.latitude, parada.longitude] as [number, number]),
    ),
    ...sugestoes
      .filter((s) => temPonto(s.item))
      .map((s) => [s.item.latitude!, s.item.longitude!] as [number, number]),
  ]

  const mapa = (
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
      <Enquadrar pontos={pontos} expandido={expandido} />

      {/* As esmaecidas por baixo; a principal por cima. */}
      {[...rotas]
        .sort((a, b) => Number(!a.esmaecida) - Number(!b.esmaecida))
        .map((rota) => (
          <LinhaDaRota
            key={rota.id}
            rota={rota}
            trajeto={rota === principal ? trajeto : 'inteira'}
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
        rota.paradas.map(({ parada: p, numero, avulsa }) =>
          rota.esmaecida ? (
            <CircleMarker
              key={`esm-${rota.id}-${p.card_id}`}
              center={[p.latitude, p.longitude]}
              radius={6}
              pathOptions={{
                color: rota.cor,
                fillColor: rota.cor,
                fillOpacity: 0.35,
                opacity: 0.5,
                weight: 2,
              }}
            >
              <Popup>
                {avulsa ? 'Parada avulsa' : `Pedido ${p.numero}`} · outro caminhão
                <br />
                {avulsa ? avulsa.titulo : p.cliente_nome}
              </Popup>
            </CircleMarker>
          ) : avulsa ? (
            // SESSAO-41 (D-196): a parada avulsa — quadrado "A", a mesma numeração dos pedidos
            <Marker
              key={`avu-${rota.id}-${p.card_id}`}
              position={[p.latitude, p.longitude]}
              icon={iconeParadaAvulsa(numero, rota.cor)}
            >
              <Popup>
                <strong>{numero}ª parada · Parada avulsa</strong>
                <br />
                {avulsa.titulo}
                <br />
                {avulsa.endereco}
              </Popup>
            </Marker>
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
            eventHandlers={
              aoEscolherSugestao ? { click: () => aoEscolherSugestao(item) } : undefined
            }
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
  )

  return (
    <div
      className={cn(
        // isolate: as camadas do Leaflet (z-index 400–1000) ficam DENTRO do mapa —
        // sem isso o mapa desenhava por cima da barra fixa do Programar e das bolhas
        'relative isolate overflow-hidden rounded-dm-lg border border-borda bg-superficie',
        classeAltura,
      )}
    >
      {/* O lugar do mapa na página (o nó do Leaflet entra aqui quando recolhido). */}
      <div ref={setLugarNaPagina} className="absolute inset-0" />
      {expandido && (
        <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-texto-suave">
          O mapa está aberto em tela cheia.
        </p>
      )}

      {/* left-14: o resumo nunca cobre o + / − do zoom (canto esquerdo) em mapa estreito */}
      {!expandido && (
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
            ref={botaoExpandir}
            variante="secundaria"
            icone={<Maximize2 />}
            onClick={() => setExpandido(true)}
            aria-label="Expandir o mapa"
            className="shadow"
          >
            Expandir
          </Botao>
        </div>
      )}

      {/* SESSAO-38: ida × volta — botões grandes (tablet), no canto de baixo à esquerda */}
      {aoMudarTrajeto && temRota && !expandido && (
        <div
          role="group"
          aria-label="O que mostrar da rota"
          className="absolute bottom-2 left-2 z-[1000] flex overflow-hidden rounded-dm border border-borda bg-superficie/95 shadow"
        >
          {OPCOES_TRAJETO.map((opcao) => {
            const ativo = trajeto === opcao.valor
            return (
              <button
                key={opcao.valor}
                type="button"
                aria-pressed={ativo}
                onClick={() => aoMudarTrajeto(opcao.valor)}
                className={cn(
                  'min-h-toque-md px-3 text-xs font-semibold transition-colors sm:text-sm',
                  ativo ? 'bg-acao text-acao-texto' : 'text-texto hover:bg-superficie-sutil',
                )}
              >
                {opcao.rotulo}
              </button>
            )
          })}
        </div>
      )}

      {/* O Leaflet desenha dentro do nó que muda de casa — nunca é recriado. */}
      {createPortal(mapa, casaDoMapa)}

      {/* A tela cheia: por cima de tudo (barra lateral/gaveta 55, bolhas 40,
          barra de cima 30, barra de baixo do Programar); abaixo dos avisos (60). */}
      {expandido &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mapa da rota em tela cheia"
            className="fixed inset-0 z-[57] bg-superficie"
          >
            <div ref={setLugarNaCamada} className="absolute inset-0 isolate" />
            <div className="absolute top-3 right-3 z-10 flex flex-wrap justify-end gap-2">
              <Botao
                ref={botaoVer}
                variante="secundaria"
                icone={<List />}
                aria-expanded={vendoPedidos}
                aria-controls={idLista}
                onClick={() => setVendoPedidos((v) => !v)}
                className="shadow"
              >
                Ver pedidos
                {paradasParaVer.length > 0 && (
                  <span className="tabular-nums">({paradasParaVer.length})</span>
                )}
              </Botao>
              <Botao
                ref={botaoRecolher}
                variante="secundaria"
                icone={<Minimize2 />}
                onClick={recolher}
                className="shadow"
              >
                Recolher o mapa
              </Botao>
            </div>
            {vendoPedidos && (
              <div
                ref={painelVer}
                id={idLista}
                role="region"
                aria-label="Pedidos da rota"
                className="absolute top-[4.25rem] right-3 z-10 flex max-h-[calc(100dvh-5.5rem)] w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie shadow-lg"
              >
                <div className="flex items-center justify-between gap-2 border-b border-borda py-1 pr-1 pl-3">
                  <span className="text-sm font-semibold text-texto">Pedidos da rota</span>
                  <button
                    type="button"
                    onClick={() => {
                      setVendoPedidos(false)
                      botaoVer.current?.focus()
                    }}
                    aria-label="Fechar a lista"
                    className="toque-seguro inline-flex size-9 items-center justify-center rounded-dm text-texto-suave hover:bg-superficie-sutil hover:text-texto"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
                {paradasParaVer.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-texto-suave">
                    Nenhum pedido no mapa — marque pedidos na lista para montar a rota.
                  </p>
                ) : (
                  <ol className="min-h-0 flex-1 divide-y divide-borda overflow-y-auto">
                    {paradasParaVer.map((p, i) => (
                      <li key={p.chave} className="flex gap-2.5 px-3 py-2">
                        <span
                          aria-hidden
                          className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-acao text-xs font-bold text-acao-texto tabular-nums"
                        >
                          {i + 1}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="text-sm font-semibold text-texto tabular-nums">
                            {p.titulo}
                          </span>
                          <span className="text-xs text-texto-suave">{p.endereco}</span>
                          {p.entrega && (
                            <span className="text-xs text-texto-suave tabular-nums">
                              Entrega {p.entrega}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
})

const SEM_SUGESTOES: Sugestao<PedidoProgramacao>[] = []
const SEM_PEDIDOS: PedidoParaVer[] = []
