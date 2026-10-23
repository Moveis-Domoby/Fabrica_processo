import { Suspense, lazy, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/cn'

// A busca é pedaço próprio (Lei §9): só baixa na primeira vez que abre.
const BuscaGeral = lazy(() => import('./BuscaGeral'))

/**
 * SESSAO-40 (D-188): a lupa da busca geral, ao lado do sino — na barra do
 * menu (computador e gaveta) e na barra do celular. Ctrl+K (⌘K no Mac) abre
 * de qualquer tela — só a lupa com `atalho` escuta o teclado (uma só na casca).
 */
export function BotaoBuscaGeral({
  atalho = false,
  className,
}: {
  atalho?: boolean
  className?: string
}) {
  const [aberta, setAberta] = useState(false)
  const [usada, setUsada] = useState(false)

  useEffect(() => {
    if (!atalho) return
    function aoTeclar(evento: KeyboardEvent) {
      if (
        (evento.ctrlKey || evento.metaKey) &&
        !evento.altKey &&
        evento.key.toLowerCase() === 'k'
      ) {
        evento.preventDefault()
        setUsada(true)
        setAberta(true)
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [atalho])

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setUsada(true)
          setAberta(true)
        }}
        // pré-carrega o pedaço da busca na intenção (mouse/foco/dedo) — Lei §9
        onPointerEnter={() => void import('./BuscaGeral')}
        onFocus={() => void import('./BuscaGeral')}
        aria-label="Buscar card (Ctrl+K)"
        title="Buscar card em todos os setores (Ctrl+K)"
        className={cn(
          'toque-seguro relative inline-flex h-toque-md w-toque-md items-center justify-center rounded-dm text-grafite-100 transition-colors hover:bg-grafite-600',
          className,
        )}
      >
        <Search aria-hidden className="size-5" />
      </button>
      {usada && (
        <Suspense fallback={null}>
          <BuscaGeral aberto={aberta} aoFechar={() => setAberta(false)} />
        </Suspense>
      )}
    </>
  )
}
