import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as EventoPonteiro } from 'react'
import { Maximize2, Minus, Plus, Unplug, X, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { TipoPasso } from '../catalogo'
import { ICONE_PASSO } from '../icones'
import { ALTURA_BLOCO, ID_QUANDO, LARGURA_BLOCO, limites, ligar, moverBloco, podeLigar, sequencia } from '../desenho'
import type { EstadoDesenho, Posicao } from '../desenho'


const ZOOM_MIN = 0.4
const ZOOM_MAX = 1.6
const MEIO = ALTURA_BLOCO / 2

interface Vista {
  x: number
  y: number
  zoom: number
}

type Gesto =
  | { tipo: 'pan'; inicio: Posicao; vista: Vista }
  | { tipo: 'bloco'; id: string; inicio: Posicao; original: Posicao; moveu: boolean }
  | { tipo: 'ligar'; de: string; ponto: Posicao }

function curva(a: Posicao, b: Posicao): string {
  const dx = Math.max(60, Math.abs(b.x - a.x) / 2)
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`
}

/**
 * O CANVAS das automações (SESSAO-27 · D-103 — "canvas próprio leve/SVG",
 * sem biblioteca nova): blocos em HTML posicionados, ligações em SVG.
 * Gestos por ponteiro (mouse e toque, o mesmo desenho do balão do chat):
 * arrastar o fundo anda pelo quadro, arrastar o cabeçalho do bloco muda o
 * lugar dele, arrastar a bolinha da direita até a da esquerda de outro bloco
 * LIGA os dois. Nada depende só do arrasto: o "+" põe o próximo bloco já
 * ligado, a ligação se tira tocando nela, e o painel ao lado configura.
 */
export function CanvasAutomacao({
  estado,
  aoMudar,
  selecionado,
  aoSelecionar,
  aoAdicionar,
  titulos,
  somenteLeitura = false,
  cheio = false,
}: {
  estado: EstadoDesenho
  aoMudar: (estado: EstadoDesenho) => void
  selecionado: string | null
  aoSelecionar: (id: string | null) => void
  aoAdicionar: (depoisDe: string) => void
  /** título e frase de cada bloco (id → {titulo, frase, icone}) */
  titulos: (id: string) => { titulo: string; frase: string; tipo: TipoPasso | 'quando' }
  somenteLeitura?: boolean
  /** Área de trabalho em tela cheia: o canvas ocupa todo o espaço do pai, sem moldura. */
  cheio?: boolean
}) {
  const area = useRef<HTMLDivElement>(null)
  const [vista, setVista] = useState<Vista>({ x: 0, y: 0, zoom: 1 })
  const [gesto, setGesto] = useState<Gesto | null>(null)
  const [ligacaoEscolhida, setLigacaoEscolhida] = useState<string | null>(null)
  const naSequencia = new Set(sequencia(estado))

  const posicaoDe = useCallback(
    (id: string): Posicao =>
      id === ID_QUANDO ? estado.posicaoQuando : (estado.blocos.find((b) => b.id === id)?.posicao ?? { x: 0, y: 0 }),
    [estado],
  )

  // Ponto da tela → ponto do quadro (desfaz o andar e o zoom).
  const paraQuadro = useCallback(
    (clienteX: number, clienteY: number): Posicao => {
      const r = area.current?.getBoundingClientRect()
      return {
        x: (clienteX - (r?.left ?? 0) - vista.x) / vista.zoom,
        y: (clienteY - (r?.top ?? 0) - vista.y) / vista.zoom,
      }
    },
    [vista],
  )

  const caberNaTela = useCallback(() => {
    const r = area.current?.getBoundingClientRect()
    if (!r || r.width === 0) return
    const l = limites(estado)
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min((r.width - 48) / l.largura, (r.height - 48) / l.altura, 1)))
    setVista({ zoom, x: (r.width - l.largura * zoom) / 2 - l.x * zoom, y: (r.height - l.altura * zoom) / 2 - l.y * zoom })
  }, [estado])

  // Ao abrir uma automação, o desenho inteiro cabe na tela (uma vez, no
  // próximo quadro — a medida do contêiner só existe depois de pintar).
  const jaCoube = useRef(false)
  useEffect(() => {
    if (jaCoube.current) return
    jaCoube.current = true
    const quadro = requestAnimationFrame(caberNaTela)
    return () => cancelAnimationFrame(quadro)
  }, [caberNaTela])

  const zoomPara = useCallback((multiplicador: number) => {
    const r = area.current?.getBoundingClientRect()
    const centro = { x: (r?.width ?? 0) / 2, y: (r?.height ?? 0) / 2 }
    setVista((v) => {
      const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.zoom * multiplicador))
      return { zoom: z, x: centro.x - ((centro.x - v.x) / v.zoom) * z, y: centro.y - ((centro.y - v.y) / v.zoom) * z }
    })
  }, [])

  // Ctrl + rodinha aproxima/afasta o QUADRO (e não a página): o ouvinte do
  // React é passivo e não pode impedir o zoom do navegador — este não é.
  useEffect(() => {
    const el = area.current
    if (!el) return
    const aoRolar = (evento: WheelEvent) => {
      if (!evento.ctrlKey && !evento.metaKey) return
      evento.preventDefault()
      zoomPara(evento.deltaY < 0 ? 1.1 : 0.9)
    }
    el.addEventListener('wheel', aoRolar, { passive: false })
    return () => el.removeEventListener('wheel', aoRolar)
  }, [zoomPara])

  function aoBaixarFundo(evento: EventoPonteiro<HTMLDivElement>) {
    if (evento.target !== evento.currentTarget && !(evento.target as HTMLElement).dataset.fundo) return
    evento.currentTarget.setPointerCapture(evento.pointerId)
    setGesto({ tipo: 'pan', inicio: { x: evento.clientX, y: evento.clientY }, vista })
    setLigacaoEscolhida(null)
    aoSelecionar(null)
  }

  function aoBaixarBloco(evento: EventoPonteiro<HTMLElement>, id: string) {
    evento.stopPropagation()
    if (somenteLeitura) {
      aoSelecionar(id)
      return
    }
    area.current?.setPointerCapture(evento.pointerId)
    setGesto({ tipo: 'bloco', id, inicio: { x: evento.clientX, y: evento.clientY }, original: posicaoDe(id), moveu: false })
  }

  function aoBaixarSaida(evento: EventoPonteiro<HTMLElement>, id: string) {
    evento.stopPropagation()
    if (somenteLeitura) return
    area.current?.setPointerCapture(evento.pointerId)
    setGesto({ tipo: 'ligar', de: id, ponto: paraQuadro(evento.clientX, evento.clientY) })
  }

  function aoMoverPonteiro(evento: EventoPonteiro<HTMLDivElement>) {
    if (!gesto) return
    if (gesto.tipo === 'pan') {
      setVista({
        ...gesto.vista,
        x: gesto.vista.x + evento.clientX - gesto.inicio.x,
        y: gesto.vista.y + evento.clientY - gesto.inicio.y,
      })
    } else if (gesto.tipo === 'bloco') {
      const dx = (evento.clientX - gesto.inicio.x) / vista.zoom
      const dy = (evento.clientY - gesto.inicio.y) / vista.zoom
      if (!gesto.moveu && Math.hypot(dx, dy) < 4) return
      if (!gesto.moveu) setGesto({ ...gesto, moveu: true })
      aoMudar(moverBloco(estado, gesto.id, { x: gesto.original.x + dx, y: gesto.original.y + dy }))
    } else {
      setGesto({ ...gesto, ponto: paraQuadro(evento.clientX, evento.clientY) })
    }
  }

  function aoSoltarPonteiro(evento: EventoPonteiro<HTMLDivElement>) {
    if (!gesto) return
    if (gesto.tipo === 'bloco' && !gesto.moveu) aoSelecionar(gesto.id)
    if (gesto.tipo === 'ligar') {
      // quem está debaixo do dedo/ponteiro? (a bolinha de entrada OU o bloco)
      const alvo = document
        .elementsFromPoint(evento.clientX, evento.clientY)
        .map((el) => (el as HTMLElement).closest?.('[data-bloco]') as HTMLElement | null)
        .find((el) => el && el.dataset.bloco)
      const para = alvo?.dataset.bloco
      if (para && podeLigar(estado, gesto.de, para)) aoMudar(ligar(estado, gesto.de, para))
    }
    setGesto(null)
  }

  const ids = [ID_QUANDO, ...estado.blocos.map((b) => b.id)]
  const ligacoesDesenhadas = estado.ligacoes.map((l) => {
    const a = posicaoDe(l.de)
    const b = posicaoDe(l.para)
    const pa = { x: a.x + LARGURA_BLOCO, y: a.y + MEIO }
    const pb = { x: b.x, y: b.y + MEIO }
    return { chave: `${l.de}>${l.para}`, de: l.de, d: curva(pa, pb), meio: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 } }
  })

  return (
    <div className={cn('relative', cheio && 'h-full')}>
      <div
        ref={area}
        role="application"
        aria-label="Desenho da automação"
        data-fundo="1"
        onPointerDown={aoBaixarFundo}
        onPointerMove={aoMoverPonteiro}
        onPointerUp={aoSoltarPonteiro}
        onPointerCancel={() => setGesto(null)}
        className={cn(
          'relative w-full touch-none select-none overflow-hidden bg-superficie-sutil',
          cheio ? 'h-full' : 'h-[clamp(24rem,62vh,46rem)] rounded-dm-lg border border-borda',
          gesto?.tipo === 'pan' ? 'cursor-grabbing' : 'cursor-grab',
        )}
        style={{
          backgroundImage: 'radial-gradient(var(--dm-borda-forte) 1px, transparent 1px)',
          backgroundSize: `${22 * vista.zoom}px ${22 * vista.zoom}px`,
          backgroundPosition: `${vista.x}px ${vista.y}px`,
        }}
      >
        <div
          data-fundo="1"
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.zoom})` }}
        >
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden>
            {ligacoesDesenhadas.map((l) => (
              <g key={l.chave}>
                <path
                  d={l.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={18}
                  className="pointer-events-auto cursor-pointer"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    setLigacaoEscolhida(l.chave)
                  }}
                />
                <path
                  d={l.d}
                  fill="none"
                  stroke={ligacaoEscolhida === l.chave ? 'var(--dm-acao-ativa)' : 'var(--dm-texto-suave)'}
                  strokeWidth={ligacaoEscolhida === l.chave ? 3 : 2}
                  markerEnd="url(#seta-automacao)"
                />
              </g>
            ))}
            {gesto?.tipo === 'ligar' && (
              <path
                d={curva(
                  { x: posicaoDe(gesto.de).x + LARGURA_BLOCO, y: posicaoDe(gesto.de).y + MEIO },
                  gesto.ponto,
                )}
                fill="none"
                stroke="var(--dm-acao-ativa)"
                strokeWidth={2}
                strokeDasharray="6 4"
              />
            )}
            <defs>
              <marker id="seta-automacao" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--dm-texto-suave)" />
              </marker>
            </defs>
          </svg>

          {ligacoesDesenhadas
            .filter((l) => l.chave === ligacaoEscolhida && !somenteLeitura)
            .map((l) => (
              <button
                key={`x-${l.chave}`}
                type="button"
                aria-label="Tirar esta ligação"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  aoMudar({ ...estado, ligacoes: estado.ligacoes.filter((x) => `${x.de}>${x.para}` !== l.chave) })
                  setLigacaoEscolhida(null)
                }}
                className="absolute z-10 inline-flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-borda-forte bg-superficie text-texto shadow"
                style={{ left: l.meio.x, top: l.meio.y }}
              >
                <Unplug aria-hidden className="size-4" />
              </button>
            ))}

          {ids.map((id) => {
            const p = posicaoDe(id)
            const info = titulos(id)
            const ehQuando = id === ID_QUANDO
            const solto = !ehQuando && !naSequencia.has(id)
            const temSaida = estado.ligacoes.some((l) => l.de === id)
            return (
              <div
                key={id}
                data-bloco={ehQuando ? undefined : id}
                className={cn(
                  'absolute flex flex-col rounded-dm-lg border-2 bg-superficie shadow-sm',
                  selecionado === id ? 'border-acao-ativa' : ehQuando ? 'border-marca-500' : 'border-borda-forte',
                  solto && 'border-dashed opacity-80',
                )}
                style={{ left: p.x, top: p.y, width: LARGURA_BLOCO, minHeight: ALTURA_BLOCO }}
              >
                <button
                  type="button"
                  onPointerDown={(e) => aoBaixarBloco(e, id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      aoSelecionar(id)
                    }
                  }}
                  className={cn(
                    'flex min-h-11 items-center gap-2 rounded-t-dm-lg px-3 text-left text-sm font-semibold',
                    ehQuando ? 'bg-acao text-acao-texto' : 'bg-superficie-sutil text-texto',
                    somenteLeitura ? 'cursor-pointer' : 'cursor-move',
                  )}
                  aria-label={`${info.titulo}: ${info.frase}. Toque para configurar.`}
                >
                  {ehQuando ? <Zap aria-hidden className="size-4" /> : ICONE_PASSO[info.tipo as TipoPasso]}
                  <span className="truncate">{info.titulo}</span>
                </button>
                <p className="line-clamp-3 px-3 py-2 text-xs leading-snug text-texto-suave">{info.frase}</p>
                {solto && (
                  <span className="mx-3 mb-2 self-start rounded-full bg-atencao-fundo px-2 py-0.5 text-[11px] font-medium text-atencao-texto">
                    solto — não roda
                  </span>
                )}

                {/* entrada (esquerda) — onde a ligação chega */}
                {!ehQuando && (
                  <span
                    aria-hidden
                    className="absolute -left-2.5 size-5 rounded-full border-2 border-borda-forte bg-superficie"
                    style={{ top: MEIO - 10 }}
                  />
                )}
                {/* saída (direita) — arraste até outro bloco para ligar */}
                {!somenteLeitura && (
                  <span
                    role="presentation"
                    onPointerDown={(e) => aoBaixarSaida(e, id)}
                    title="Arraste até outro bloco para ligar"
                    className={cn(
                      'absolute -right-3 size-6 cursor-crosshair rounded-full border-2 bg-superficie',
                      temSaida ? 'border-acao-ativa' : 'border-borda-forte',
                    )}
                    style={{ top: MEIO - 12 }}
                  />
                )}
                {!somenteLeitura && (
                  <button
                    type="button"
                    aria-label={`Pôr um bloco depois de "${info.titulo}"`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => aoAdicionar(id)}
                    className="absolute -right-12 inline-flex size-9 items-center justify-center rounded-full border border-borda-forte bg-superficie text-texto shadow-sm transition hover:-translate-y-0.5 hover:shadow"
                    style={{ top: MEIO - 18 }}
                  >
                    <Plus aria-hidden className="size-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="absolute bottom-3 right-3 flex gap-1 rounded-dm border border-borda bg-superficie p-1 shadow-sm">
        <button
          type="button"
          aria-label="Afastar"
          onClick={() => zoomPara(0.85)}
          className="inline-flex size-11 items-center justify-center rounded-dm text-texto hover:bg-superficie-sutil"
        >
          <Minus aria-hidden className="size-4" />
        </button>
        <span className="inline-flex min-w-12 items-center justify-center text-xs tabular-nums text-texto-suave">
          {Math.round(vista.zoom * 100)}%
        </span>
        <button
          type="button"
          aria-label="Aproximar"
          onClick={() => zoomPara(1.15)}
          className="inline-flex size-11 items-center justify-center rounded-dm text-texto hover:bg-superficie-sutil"
        >
          <Plus aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Caber tudo na tela"
          onClick={caberNaTela}
          className="inline-flex size-11 items-center justify-center rounded-dm text-texto hover:bg-superficie-sutil"
        >
          <Maximize2 aria-hidden className="size-4" />
        </button>
      </div>
      {ligacaoEscolhida && !somenteLeitura && (
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-dm border border-borda bg-superficie px-3 py-1.5 text-xs text-texto-suave shadow-sm">
          Ligação escolhida — toque no
          <Unplug aria-hidden className="size-3.5" />
          para tirar
          <button
            type="button"
            aria-label="Desfazer a escolha"
            onClick={() => setLigacaoEscolhida(null)}
            className="inline-flex size-6 items-center justify-center rounded text-texto-suave hover:bg-superficie-sutil"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
