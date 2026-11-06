import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router'
import { ChevronDown, Ellipsis, LogOut, Palette } from 'lucide-react'
import { cn } from '@/lib/cn'
import { TemasDoMenu } from '@/perfil/SeletorTemaRapido'
import { ROTULO_TEMA, ehTema } from '@/perfil/tema'
import { useSessao } from '@/autenticacao/sessao-contexto'

/** A largura do painel (px) — a mesma do `w-60`. */
const LARGURA = 240

// ↩️ 06/11 (2ª volta, pedido do dono): o mini menu segue as cores da barra
// lateral (`menu-superficie` + grafite, que cada tema retinta), não as da página.
const ITEM =
  'flex min-h-toque-md w-full items-center gap-2.5 rounded-dm px-2 text-left text-[0.8125rem] text-grafite-100 transition-colors hover:bg-grafite-600 [@media(pointer:fine)]:min-h-9'

/**
 * O mini menu do rodapé da barra lateral — ajuste do dono de 06/11: *"coloque
 * todos esses ícones na parte inferior… dentro de um mini modal ao lado do
 * nome do usuário… que armazena os ícones de pesquisar, sair, trocar tema"*.
 * ↩️ 4ª volta (06/11): o sino e a lupa moram só na barra escura de cima — aqui
 * ficam o Tema (a lista escondida dentro dele) e o Sair.
 *
 * O painel vai para o fim do `body` (portal) e é `fixed`, posicionado pelo
 * botão na hora de abrir — o `translate` da gaveta prenderia o `fixed` à barra
 * (E-48). Fecha no Esc, em qualquer toque fora (escuta de captura, como o
 * sino), ao trocar de tela e ao escolher Sair. Camada 58: acima da
 * gaveta do celular (55), abaixo dos avisos passageiros (60).
 */
export function MenuDoUsuario({
  recolhida,
  aoSair,
}: {
  /** Barra recolhida (trilho de ícones): o painel abre para o lado. */
  recolhida: boolean
  aoSair: () => void
}) {
  const { pathname } = useLocation()
  const { perfil } = useSessao()
  const idTemas = useId()
  // ↩️ 06/11 (2ª volta — "os temas devem ficar ocultos dentro do ícone de
  // tema"): a lista só aparece ao tocar em Tema; fecha de novo a cada abertura.
  const [temasAbertos, setTemasAbertos] = useState(false)
  const temaAtual = perfil && ehTema(perfil.tema) ? ROTULO_TEMA[perfil.tema] : null
  // Aberto só na tela em que foi aberto: trocar de tela fecha (como o sino).
  const [abertoEm, setAbertoEm] = useState<string | null>(null)
  const aberto = abertoEm === pathname
  const [posicao, setPosicao] = useState<{ left: number; bottom: number }>({ left: 8, bottom: 8 })
  const botaoRef = useRef<HTMLButtonElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)

  function abrir() {
    const r = botaoRef.current?.getBoundingClientRect()
    if (r) {
      const largura = Math.min(LARGURA, window.innerWidth - 16)
      const maxLeft = window.innerWidth - largura - 8
      setPosicao(
        recolhida
          ? // ao lado do trilho, com o pé alinhado ao do botão
            {
              left: Math.min(r.right + 8, maxLeft),
              bottom: Math.max(8, window.innerHeight - r.bottom),
            }
          : // acima do botão, terminando na borda direita dele
            {
              left: Math.max(8, Math.min(r.right - largura, maxLeft)),
              bottom: window.innerHeight - r.top + 8,
            },
      )
    }
    setTemasAbertos(false)
    setAbertoEm(pathname)
  }
  const fechar = () => setAbertoEm(null)

  useEffect(() => {
    if (!aberto) return
    const aoTocar = (evento: PointerEvent) => {
      const alvo = evento.target
      if (alvo instanceof Node) {
        if (painelRef.current?.contains(alvo)) return
        // o próprio botão alterna no clique dele
        if (botaoRef.current?.contains(alvo)) return
      }
      setAbertoEm(null)
    }
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return
      setAbertoEm(null)
      botaoRef.current?.focus()
    }
    const aoRedimensionar = () => setAbertoEm(null)
    window.addEventListener('pointerdown', aoTocar, true)
    window.addEventListener('keydown', aoTeclar, true)
    window.addEventListener('resize', aoRedimensionar)
    // ao abrir, o foco vai para o primeiro item (teclado)
    painelRef.current?.querySelector<HTMLElement>('button')?.focus()
    return () => {
      window.removeEventListener('pointerdown', aoTocar, true)
      window.removeEventListener('keydown', aoTeclar, true)
      window.removeEventListener('resize', aoRedimensionar)
    }
  }, [aberto])

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={() => (aberto ? fechar() : abrir())}
        aria-label="Mais opções: tema e sair"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        title="Mais opções"
        className={cn(
          'toque-seguro inline-flex size-8 shrink-0 items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600',
          aberto && 'bg-grafite-600',
        )}
      >
        <Ellipsis aria-hidden className="size-5" />
      </button>

      {aberto &&
        createPortal(
          <div
            ref={painelRef}
            role="dialog"
            aria-label="Mais opções"
            style={{ left: posicao.left, bottom: posicao.bottom }}
            className="menu-superficie fixed z-[58] flex max-h-[calc(100dvh-1rem)] w-60 max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-dm-lg border border-grafite-600 bg-grafite-700 p-1.5 text-grafite-100 shadow-lg"
          >
            <button
              type="button"
              onClick={() => setTemasAbertos((atual) => !atual)}
              aria-expanded={temasAbertos}
              aria-controls={idTemas}
              className={cn(ITEM, temasAbertos && 'bg-grafite-600')}
            >
              <Palette aria-hidden className="size-4 shrink-0" />
              <span className="flex-1">Tema</span>
              {temaAtual && (
                <span className="truncate text-[0.6875rem] text-grafite-300">{temaAtual}</span>
              )}
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-4 shrink-0 transition-transform',
                  !temasAbertos && '-rotate-90',
                )}
              />
            </button>
            {temasAbertos && (
              <div id={idTemas} className="mt-0.5 mb-1 ml-3.5 border-l border-grafite-600 pl-1.5">
                <TemasDoMenu />
              </div>
            )}
            <div className="my-1 border-t border-grafite-600" />
            <button
              type="button"
              onClick={() => {
                fechar()
                aoSair()
              }}
              className={ITEM}
            >
              <LogOut aria-hidden className="size-4 shrink-0" />
              Sair da conta
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}
