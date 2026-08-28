import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

export type VarianteBotao = 'primaria' | 'secundaria' | 'fantasma' | 'perigo'
export type TamanhoBotao = 'sm' | 'md' | 'lg' | 'galpao'

const VARIANTES: Record<VarianteBotao, string> = {
  primaria: 'bg-acao text-acao-texto hover:bg-acao-hover active:bg-acao-ativa border-transparent',
  secundaria:
    'bg-superficie text-texto border-borda-forte hover:bg-superficie-sutil active:bg-grafite-200',
  fantasma: 'bg-transparent text-texto border-transparent hover:bg-superficie-sutil',
  perigo: 'bg-perigo text-white border-transparent hover:brightness-110 active:brightness-95',
}

const TAMANHOS: Record<TamanhoBotao, string> = {
  sm: 'h-toque-sm px-3 text-sm gap-1.5',
  md: 'h-toque-md px-4 text-base gap-2',
  lg: 'h-toque-lg px-6 text-lg gap-2.5',
  galpao: 'h-toque-galpao px-8 text-xl font-semibold gap-3',
}

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao
  tamanho?: TamanhoBotao
  carregando?: boolean
  larguraTotal?: boolean
  icone?: ReactNode
}

/**
 * Botão base do design system.
 *
 * Regras (modelo de sistema — `_docs/Plataforma/PLT - Modelo de Sistema.md`):
 * - `primaria` é a AÇÃO da tela — no máximo uma por bloco de decisão.
 * - `galpao` é o tamanho das ações do operador em tablet (64px de altura).
 * - Nunca use `perigo` para movimentar card: mover não é destruir.
 * - Microinteração padrão: elevação leve (2px) + sombra suave ao interagir,
 *   e o toque "assenta" o botão de volta — sutil de propósito.
 */
export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(function Botao(
  {
    variante = 'primaria',
    tamanho = 'md',
    carregando = false,
    larguraTotal = false,
    icone,
    disabled,
    className,
    children,
    ...resto
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-dm border font-medium',
        'transition-[color,background-color,border-color,box-shadow,translate] duration-150 select-none',
        // Elevação leve ao interagir + assentar no toque — só em botão habilitado.
        'enabled:hover:-translate-y-0.5 enabled:hover:shadow-md enabled:hover:shadow-grafite-950/20',
        'enabled:focus-visible:-translate-y-0.5 enabled:focus-visible:shadow-md enabled:focus-visible:shadow-grafite-950/20',
        'enabled:active:translate-y-0 enabled:active:shadow-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTES[variante],
        TAMANHOS[tamanho],
        larguraTotal && 'w-full',
        className,
      )}
      {...resto}
    >
      {carregando ? (
        <Loader2 aria-hidden className="size-[1.15em] animate-spin" />
      ) : (
        icone && (
          <span aria-hidden className="inline-flex shrink-0 [&>svg]:size-[1.15em]">
            {icone}
          </span>
        )
      )}
      {children}
    </button>
  )
})
