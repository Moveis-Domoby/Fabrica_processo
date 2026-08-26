import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  rotulo: string
  ajuda?: string
  erro?: string
  /** Esconde o rótulo visualmente, mantendo-o para leitores de tela. */
  rotuloOculto?: boolean
  prefixo?: ReactNode
}

/**
 * Campo de texto com rótulo, ajuda e erro — nunca use `<input>` solto:
 * campo sem rótulo visível é o erro de acessibilidade mais comum do galpão.
 */
export const Campo = forwardRef<HTMLInputElement, CampoProps>(function Campo(
  { rotulo, ajuda, erro, rotuloOculto = false, prefixo, id, className, ...resto },
  ref,
) {
  const idGerado = useId()
  const idCampo = id ?? idGerado
  const idAjuda = `${idCampo}-ajuda`
  const idErro = `${idCampo}-erro`

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor={idCampo}
        className={cn('text-sm font-medium text-texto', rotuloOculto && 'sr-only')}
      >
        {rotulo}
      </label>

      <div className="relative flex items-center">
        {prefixo && (
          <span aria-hidden className="absolute left-3 text-texto-fraco [&>svg]:size-5">
            {prefixo}
          </span>
        )}
        <input
          ref={ref}
          id={idCampo}
          aria-invalid={erro ? true : undefined}
          aria-describedby={cn(ajuda && idAjuda, erro && idErro) || undefined}
          className={cn(
            'h-toque-md w-full rounded-dm border bg-superficie px-3 text-texto',
            'placeholder:text-texto-fraco',
            'transition-colors',
            'disabled:cursor-not-allowed disabled:bg-superficie-sutil disabled:opacity-60',
            erro ? 'border-danificado-forte' : 'border-borda-forte',
            prefixo && 'pl-10',
            className,
          )}
          {...resto}
        />
      </div>

      {ajuda && !erro && (
        <p id={idAjuda} className="text-sm text-texto-suave">
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={idErro} className="flex items-center gap-1.5 text-sm text-danificado-forte">
          <AlertCircle aria-hidden className="size-4 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  )
})
