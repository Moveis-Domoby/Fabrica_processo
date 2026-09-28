import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as EventoPonteiro } from 'react'
import { Link, useLocation } from 'react-router'
import { Maximize2, MessageCircle, X } from 'lucide-react'
import { useSessao } from '@/autenticacao/sessao-contexto'
import { rotuloContagem } from './cache'
import { ListaConversas } from './componentes/ListaConversas'
import { PainelConversa } from './componentes/PainelConversa'
import { useChat } from './contexto'
import {
  guardarPosicao,
  LIMIAR_ARRASTO,
  limitarPosicao,
  lerPosicao,
  posicaoPadrao,
} from './posicao'
import type { PosicaoBalao } from './posicao'

function tela() {
  return { largura: window.innerWidth, altura: window.innerHeight }
}

/**
 * O balão do chat (SESSAO-26): presente em todas as telas logadas (o /tablet
 * nem monta a casca), fica no canto inferior direito e se ARRASTA com o dedo
 * ou o mouse (pointer events — sem biblioteca); a posição fica guardada por
 * pessoa neste aparelho. Fechado, custa só o badge (a 1ª página da lista,
 * já lida pelo provedor). O toque abre o painel compacto sem sair da tela.
 * Na própria tela do Chat ele some (seria o chat dentro do chat).
 */
export function BalaoChat() {
  const { perfil } = useSessao()
  const { totalNaoLidas } = useChat()
  const location = useLocation()
  const eu = perfil?.id ?? ''

  const [posicao, setPosicao] = useState<PosicaoBalao>(() =>
    limitarPosicao(lerPosicao(eu) ?? posicaoPadrao(window.innerWidth), tela()),
  )
  const [aberto, setAberto] = useState(false)
  const [conversa, setConversa] = useState<number | null>(null)
  const arrasto = useRef<{ x: number; y: number; inicio: PosicaoBalao; moveu: boolean } | null>(null)

  // Janela mudou de tamanho: o balão continua inteiro na tela.
  useEffect(() => {
    const aoRedimensionar = () => setPosicao((atual) => limitarPosicao(atual, tela()))
    window.addEventListener('resize', aoRedimensionar)
    return () => window.removeEventListener('resize', aoRedimensionar)
  }, [])

  // ESC fecha o painel.
  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto])

  if (!perfil || location.pathname.startsWith('/inicio/chat')) return null

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
    setPosicao(
      limitarPosicao({ direita: atual.inicio.direita - dx, baixo: atual.inicio.baixo - dy }, tela()),
    )
  }

  function aoSoltar(e: EventoPonteiro<HTMLButtonElement>) {
    const atual = arrasto.current
    arrasto.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (!atual) return
    if (atual.moveu) {
      const final = limitarPosicao(
        {
          direita: atual.inicio.direita - (e.clientX - atual.x),
          baixo: atual.inicio.baixo - (e.clientY - atual.y),
        },
        tela(),
      )
      setPosicao(final)
      guardarPosicao(eu, final)
    } else {
      setAberto(true)
    }
  }

  const rotulo =
    totalNaoLidas > 0
      ? `Chat: ${rotuloContagem(totalNaoLidas)} mensagem${totalNaoLidas === 1 ? '' : 's'} não lida${totalNaoLidas === 1 ? '' : 's'}`
      : 'Chat'

  return (
    <>
      {!aberto && (
        <button
          type="button"
          aria-label={rotulo}
          aria-haspopup="dialog"
          title="Chat — toque para abrir, arraste para mudar de lugar"
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
          className="fixed z-40 inline-flex size-toque-lg cursor-grab select-none items-center justify-center rounded-full border-2 border-grafite-700 bg-superficie text-texto shadow-lg active:cursor-grabbing"
        >
          <MessageCircle aria-hidden className="size-6" />
          {totalNaoLidas > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-danificado-forte px-1 text-xs font-semibold text-white tabular-nums">
              {rotuloContagem(totalNaoLidas)}
            </span>
          )}
        </button>
      )}

      {aberto && (
        <div
          role="dialog"
          aria-label="Chat"
          className="fixed inset-x-2 top-16 bottom-2 z-50 flex flex-col overflow-hidden rounded-dm-lg border border-borda bg-superficie shadow-2xl sm:inset-x-auto sm:top-auto sm:right-4 sm:bottom-4 sm:h-[min(36rem,calc(100dvh-5rem))] sm:w-[min(24rem,calc(100vw-2rem))]"
        >
          <header className="flex items-center gap-1 border-b border-borda bg-superficie-sutil px-2 py-1">
            <MessageCircle aria-hidden className="ml-1 size-5 text-texto-suave" />
            <span className="flex-1 px-1 text-sm font-semibold text-texto">Chat</span>
            <Link
              to={conversa ? `/inicio/chat?c=${conversa}` : '/inicio/chat'}
              onClick={() => setAberto(false)}
              aria-label="Abrir o chat em tela cheia"
              title="Abrir em tela cheia"
              className="toque-seguro inline-flex h-toque-md w-toque-md items-center justify-center rounded-dm text-texto-suave hover:bg-superficie"
            >
              <Maximize2 aria-hidden className="size-4" />
            </Link>
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar o chat"
              className="toque-seguro inline-flex h-toque-md w-toque-md items-center justify-center rounded-dm text-texto-suave hover:bg-superficie"
            >
              <X aria-hidden className="size-5" />
            </button>
          </header>
          <div className="min-h-0 flex-1">
            {conversa === null ? (
              <ListaConversas selecionada={null} aoEscolher={setConversa} compacta />
            ) : (
              <PainelConversa
                key={conversa}
                conversaId={conversa}
                aoVoltar={() => setConversa(null)}
                compacto
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}
