import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as EventoPonteiro } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { FlaskConical, Lightbulb, SquareKanban, X } from 'lucide-react'
import { Botao } from '@/componentes/ui'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { minhasTarefas } from '@/afazeres/api'
import { useMeuTrabalhoAoVivo } from '@/lib/aoVivo'
import { LIMIAR_ARRASTO, limitarPosicao } from '@/chat/posicao'
import type { PosicaoBalao } from '@/chat/posicao'
import { useAbrirSugestao } from './abrirSugestao'
import { sugestaoDaTarefa } from './regras'

// O formulário (e o gravador de áudio) só baixa no primeiro "Sugerir" (Lei §9).
const ModalSugerir = lazy(() => import('./ModalSugerir').then((m) => ({ default: m.ModalSugerir })))

export const ROTA_SUGESTOES = '/tech/sugestao-de-melhoria'

const chave = (usuarioId: string) => `dm-sugestao-bolha:${usuarioId}`

/** O canto de partida: à esquerda do balão do chat (88) e da bolinha de execução (16). */
function posicaoPadrao(larguraTela: number): PosicaoBalao {
  return { direita: 160, baixo: larguraTela < 640 ? 80 : 24 }
}

function lerPosicao(usuarioId: string): PosicaoBalao | null {
  try {
    const bruto = localStorage.getItem(chave(usuarioId))
    if (!bruto) return null
    const lido = JSON.parse(bruto) as Partial<PosicaoBalao>
    if (typeof lido.direita !== 'number' || typeof lido.baixo !== 'number') return null
    return { direita: lido.direita, baixo: lido.baixo }
  } catch {
    return null
  }
}

function guardarPosicao(usuarioId: string, posicao: PosicaoBalao) {
  try {
    localStorage.setItem(chave(usuarioId), JSON.stringify(posicao))
  } catch {
    // sem localStorage: só não fica lembrado
  }
}

function tela() {
  return { largura: window.innerWidth, altura: window.innerHeight }
}

/**
 * SESSAO-46 (D-265) — a bolinha das sugestões: acompanha TODO usuário em toda
 * tela logada, menos o modo tablet (a casca nem a monta no /tablet). Arrasta
 * como o balão do chat (posição guardada por pessoa neste aparelho). O toque
 * abre o painel: **Sugerir melhoria**, o atalho para o quadro Tech e o que a
 * pessoa tem para testar. Fechada, não pede nada ao banco: o "para testar" sai
 * das tarefas da pessoa, que já chegam na abertura e ficam ao vivo pelo canal
 * dela (a pendência é a tarefa do Sistema "Testar a sugestão #N" — D-264).
 */
export function BolhaSugestao() {
  const { perfil } = useSessao()
  const eu = perfil?.id ?? ''
  const abrirSugestao = useAbrirSugestao()
  const [posicao, setPosicao] = useState<PosicaoBalao>(() =>
    limitarPosicao(lerPosicao(eu) ?? posicaoPadrao(window.innerWidth), tela()),
  )
  const [aberto, setAberto] = useState(false)
  const [sugerindo, setSugerindo] = useState(false)
  const [jaSugeriu, setJaSugeriu] = useState(false)
  const arrasto = useRef<{ x: number; y: number; inicio: PosicaoBalao; moveu: boolean } | null>(null)
  const painel = useRef<HTMLDivElement>(null)

  useMeuTrabalhoAoVivo(perfil?.id)
  const { data: tarefas = [] } = useQuery({
    queryKey: ['afazeres', 'tarefas', perfil?.id],
    queryFn: () => minhasTarefas(perfil!.id),
    enabled: perfil !== null,
    staleTime: Infinity,
  })
  const paraTestar = useMemo(
    () =>
      tarefas
        .map((t) => ({ id: sugestaoDaTarefa(t), descricao: t.descricao }))
        .filter((t): t is { id: number; descricao: string | null } => t.id !== null),
    [tarefas],
  )

  useEffect(() => {
    const aoRedimensionar = () => setPosicao((atual) => limitarPosicao(atual, tela()))
    window.addEventListener('resize', aoRedimensionar)
    return () => window.removeEventListener('resize', aoRedimensionar)
  }, [])

  // Esc ou toque fora fecham o painel (escuta de captura na janela — E-131).
  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    const aoTocar = (e: PointerEvent) => {
      if (painel.current && !painel.current.contains(e.target as Node)) setAberto(false)
    }
    window.addEventListener('keydown', aoTeclar)
    window.addEventListener('pointerdown', aoTocar, true)
    return () => {
      window.removeEventListener('keydown', aoTeclar)
      window.removeEventListener('pointerdown', aoTocar, true)
    }
  }, [aberto])

  if (!perfil) return null

  function aoApertar(e: EventoPonteiro<HTMLButtonElement>) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    arrasto.current = { x: e.clientX, y: e.clientY, inicio: posicao, moveu: false }
  }
  function aoMover(e: EventoPonteiro<HTMLButtonElement>) {
    const atual = arrasto.current
    if (!atual) return
    const dx = e.clientX - atual.x
    const dy = e.clientY - atual.y
    if (!atual.moveu && Math.hypot(dx, dy) < LIMIAR_ARRASTO) return
    atual.moveu = true
    setPosicao(limitarPosicao({ direita: atual.inicio.direita - dx, baixo: atual.inicio.baixo - dy }, tela()))
  }
  function aoSoltar(e: EventoPonteiro<HTMLButtonElement>) {
    const atual = arrasto.current
    arrasto.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (!atual) return
    if (atual.moveu) {
      const final = limitarPosicao(
        { direita: atual.inicio.direita - (e.clientX - atual.x), baixo: atual.inicio.baixo - (e.clientY - atual.y) },
        tela(),
      )
      setPosicao(final)
      guardarPosicao(eu, final)
    } else {
      setAberto(true)
    }
  }

  const rotulo =
    paraTestar.length > 0
      ? `Sugestões: ${paraTestar.length} para você testar`
      : 'Sugestões de melhoria'

  return (
    <>
      {!aberto && (
        <button
          type="button"
          aria-label={rotulo}
          aria-haspopup="dialog"
          title="Sugerir melhoria — toque para abrir, arraste para mudar de lugar"
          onPointerDown={aoApertar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={() => {
            arrasto.current = null
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setAberto(true)
            }
          }}
          style={{ right: posicao.direita, bottom: posicao.baixo, touchAction: 'none' }}
          className="fixed z-40 inline-flex size-toque-lg cursor-grab select-none items-center justify-center rounded-full border-2 border-grafite-700 bg-acao text-acao-texto shadow-lg active:cursor-grabbing"
        >
          <Lightbulb aria-hidden className="size-6" />
          {paraTestar.length > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-info-forte px-1 text-xs font-semibold text-white tabular-nums">
              {paraTestar.length}
            </span>
          )}
        </button>
      )}

      {aberto && (
        <div
          ref={painel}
          role="dialog"
          aria-label="Sugestões de melhoria"
          className="fixed inset-x-2 bottom-2 z-50 flex flex-col gap-3 rounded-dm-lg border border-borda bg-superficie p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[min(22rem,calc(100vw-2rem))]"
        >
          <header className="flex items-center gap-2">
            <Lightbulb aria-hidden className="size-5 text-texto-suave" />
            <span className="flex-1 text-sm font-semibold text-texto">Melhorias do sistema</span>
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar"
              className="toque-seguro inline-flex h-toque-md w-toque-md items-center justify-center rounded-dm text-texto-suave hover:bg-superficie-sutil"
            >
              <X aria-hidden className="size-5" />
            </button>
          </header>
          <p className="text-sm text-texto-suave">
            Viu um erro ou tem uma ideia? Mande com um print, um áudio ou um vídeo.
          </p>
          <Botao
            variante="primaria"
            larguraTotal
            icone={<Lightbulb aria-hidden />}
            onClick={() => {
              setAberto(false)
              setJaSugeriu(true)
              setSugerindo(true)
            }}
          >
            Sugerir melhoria
          </Botao>

          {paraTestar.length > 0 && (
            <section aria-label="Para você testar" className="flex flex-col gap-1.5">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-info-texto">
                <FlaskConical aria-hidden className="size-4" /> Para você testar ({paraTestar.length})
              </h3>
              <ul className="flex flex-col gap-1">
                {paraTestar.slice(0, 5).map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setAberto(false)
                        abrirSugestao(t.id)
                      }}
                      className="flex min-h-toque-md w-full flex-col items-start justify-center rounded-dm bg-info-fundo px-3 py-1.5 text-left hover:ring-2 hover:ring-info-borda"
                    >
                      <span className="text-sm font-semibold text-info-texto">Testar a sugestão #{t.id}</span>
                      {t.descricao && (
                        <span className="line-clamp-1 text-xs text-info-texto">
                          {t.descricao.replace(/^Já está no sistema: /, '')}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Link
            to={ROTA_SUGESTOES}
            onClick={() => setAberto(false)}
            className="inline-flex min-h-toque-md items-center justify-center gap-2 rounded-dm border border-borda-forte px-3 text-sm font-medium text-texto hover:bg-superficie-sutil"
          >
            <SquareKanban aria-hidden className="size-4" />
            Acompanhar as sugestões
          </Link>
        </div>
      )}

      {jaSugeriu && (
        <Suspense fallback={null}>
          <ModalSugerir aberto={sugerindo} aoFechar={() => setSugerindo(false)} aoEnviar={abrirSugestao} />
        </Suspense>
      )}
    </>
  )
}
