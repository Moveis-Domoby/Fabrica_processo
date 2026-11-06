import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router'
import { Ellipsis, LogOut, Palette, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { TemasDoMenu } from '@/perfil/SeletorTemaRapido'
import { preCarregarBusca } from '@/busca/preCarregarBusca'

/** A largura do painel (px) — a mesma do `w-60`. */
const LARGURA = 240

const ITEM =
  'flex min-h-toque-md w-full items-center gap-2.5 rounded-[0.4rem] px-2 text-left text-[0.8125rem] transition-colors [@media(pointer:fine)]:min-h-9'

/**
 * O mini menu do rodapé da barra lateral — ajuste do dono de 06/11: *"coloque
 * todos esses ícones na parte inferior… dentro de um mini modal ao lado do
 * nome do usuário… que armazena os ícones de pesquisar, sair, trocar tema"*.
 * Ao lado do nome ficam o sino e este botão; no topo, só o recolher.
 *
 * O painel vai para o fim do `body` (portal) e é `fixed`, posicionado pelo
 * botão na hora de abrir — o `translate` da gaveta prenderia o `fixed` à barra
 * (E-48). Fecha no Esc, em qualquer toque fora (escuta de captura, como o
 * sino), ao trocar de tela e ao escolher Buscar ou Sair. Camada 58: acima da
 * gaveta do celular (55), abaixo dos avisos passageiros (60).
 */
export function MenuDoUsuario({
  recolhida,
  aoBuscar,
  aoSair,
}: {
  /** Barra recolhida (trilho de ícones): o painel abre para o lado. */
  recolhida: boolean
  /** Sem o módulo fábrica não há busca de card — o item some. */
  aoBuscar?: () => void
  aoSair: () => void
}) {
  const { pathname } = useLocation()
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
        aria-label="Mais opções: buscar card, tema e sair"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        title="Mais opções"
        className={cn(
          'toque-seguro inline-flex size-9 shrink-0 items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600',
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
            className="fixed z-[58] flex max-h-[calc(100dvh-1rem)] w-60 max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-dm-lg border border-borda bg-superficie p-1.5 text-texto shadow-lg"
          >
            {aoBuscar && (
              <>
                <button
                  type="button"
                  onPointerEnter={preCarregarBusca}
                  onFocus={preCarregarBusca}
                  onClick={() => {
                    fechar()
                    aoBuscar()
                  }}
                  className={cn(ITEM, 'hover:bg-superficie-sutil')}
                >
                  <Search aria-hidden className="size-4 shrink-0 text-texto-suave" />
                  <span className="flex-1">Buscar card</span>
                  <kbd className="rounded border border-borda px-1 font-sans text-[0.6875rem] text-texto-fraco">
                    Ctrl K
                  </kbd>
                </button>
                <div className="my-1 border-t border-borda" />
              </>
            )}
            <p className="flex items-center gap-2.5 px-2 pt-1 pb-1 text-xs font-semibold text-texto-suave">
              <Palette aria-hidden className="size-4 shrink-0" />
              Tema
            </p>
            <TemasDoMenu />
            <div className="my-1 border-t border-borda" />
            <button
              type="button"
              onClick={() => {
                fechar()
                aoSair()
              }}
              className={cn(ITEM, 'text-danificado-texto hover:bg-danificado-fundo')}
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
