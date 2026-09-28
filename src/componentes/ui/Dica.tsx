import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface DicaProps {
  /** O que o ícone explica — vira o nome acessível do botão. */
  rotulo: string
  children: ReactNode
  className?: string
}

/**
 * O "i" de informação com o balãozinho (ajuste de 28/09 — pedido do dono: o
 * texto explicativo sai de baixo do título e vira um ícone). Abre ao passar o
 * mouse, ao focar pelo teclado ou ao tocar; fecha no ESC, ao tirar o mouse ou
 * ao tocar fora.
 *
 * O balão é ancorado no PAI posicionado (ponha `relative` no cabeçalho), não
 * no ícone — assim ele nunca estoura a borda da tela no celular (lição da
 * F-07: overlay se ancora na borda da página, não no elemento).
 */
export function Dica({ rotulo, children, className }: DicaProps) {
  const [aberta, setAberta] = useState(false)
  const id = useId()
  const raiz = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!aberta) return
    const aoTocarFora = (evento: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(evento.target as Node)) setAberta(false)
    }
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberta(false)
    }
    document.addEventListener('pointerdown', aoTocarFora)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('pointerdown', aoTocarFora)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberta])

  return (
    <span
      ref={raiz}
      className={cn('inline-flex', className)}
      onMouseEnter={() => setAberta(true)}
      onMouseLeave={() => setAberta(false)}
    >
      <button
        type="button"
        aria-label={rotulo}
        aria-expanded={aberta}
        aria-describedby={aberta ? id : undefined}
        onClick={() => setAberta(true)}
        onFocus={() => setAberta(true)}
        onBlur={() => setAberta(false)}
        className={cn(
          'inline-flex size-toque-md items-center justify-center rounded-full text-texto-suave transition-colors',
          'hover:bg-superficie-sutil hover:text-texto focus-visible:bg-superficie-sutil focus-visible:text-texto',
          aberta && 'text-texto',
        )}
      >
        <Info aria-hidden className="size-5" />
      </button>
      {aberta && (
        <span
          id={id}
          role="tooltip"
          className="absolute top-full left-0 z-30 mt-2 w-full max-w-md rounded-dm-lg border border-borda bg-superficie p-4 text-sm leading-relaxed font-normal text-texto shadow-xl"
        >
          {children}
        </span>
      )}
    </span>
  )
}
