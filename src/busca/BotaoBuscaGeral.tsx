import { Suspense, lazy, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/cn'

// A busca é pedaço próprio (Lei §9): só baixa na primeira vez que abre.
const BuscaGeral = lazy(() => import('./BuscaGeral'))

/** Pré-carrega o pedaço da busca na intenção (mouse/foco/dedo) — Lei §9. */
function preCarregarBusca() {
  void import('./BuscaGeral')
}

/**
 * SESSAO-40 (D-188): a janela da busca geral, montada UMA vez na casca.
 * ↩️ Ajuste do dono (06/11): a lupa saiu do topo da barra lateral (quase
 * cobria a logo) e foi para o mini menu do rodapé, ao lado do nome — a janela
 * mora aqui, fora do mini menu, para não fechar junto com ele. Escuta o
 * Ctrl+K (⌘K no Mac) de qualquer tela; o pedaço só baixa na 1ª abertura.
 */
export function BuscaGeralNaCasca({
  aberta,
  aoAbrir,
  aoFechar,
}: {
  aberta: boolean
  aoAbrir: () => void
  aoFechar: () => void
}) {
  const [usada, setUsada] = useState(false)
  if (aberta && !usada) setUsada(true)

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (
        (evento.ctrlKey || evento.metaKey) &&
        !evento.altKey &&
        evento.key.toLowerCase() === 'k'
      ) {
        evento.preventDefault()
        aoAbrir()
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aoAbrir])

  if (!usada) return null
  return (
    <Suspense fallback={null}>
      <BuscaGeral aberto={aberta} aoFechar={aoFechar} />
    </Suspense>
  )
}

/** A lupa da barra de cima — abre a janela da casca. */
export function BotaoBuscaGeral({
  aoAbrir,
  compacto = false,
  className,
}: {
  aoAbrir: () => void
  /** ↩️ 06/11: a lupa da barra de cima, desenhada em 36 px (alvo de 44 mantido). */
  compacto?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={aoAbrir}
      onPointerEnter={preCarregarBusca}
      onFocus={preCarregarBusca}
      aria-label="Buscar card (Ctrl+K)"
      title="Buscar card em todos os setores (Ctrl+K)"
      className={cn(
        'toque-seguro relative inline-flex shrink-0 items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600',
        compacto ? 'size-9' : 'h-toque-md w-toque-md',
        className,
      )}
    >
      <Search aria-hidden className="size-5" />
    </button>
  )
}
