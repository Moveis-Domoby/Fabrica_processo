import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface Aba<T extends string> {
  valor: T
  rotulo: string
  icone?: ReactNode
}

export interface AbasProps<T extends string> {
  /** Rótulo do conjunto para leitor de tela (vira aria-label do tablist). */
  rotulo: string
  abas: Aba<T>[]
  valor: T
  aoMudar: (valor: T) => void
  /** Base dos ids (aba e painel): `${idBase}-aba-${valor}` / `${idBase}-painel`. */
  idBase: string
  /**
   * `linha` (padrão): abas com texto sobre uma linha. `quadrados` (ajuste de
   * 28/09, pedido do dono no Estoque): quadrados só com o ícone, no canto da
   * tela, que sobem ao passar o mouse e mostram o nome num balãozinho — o nome
   * também vai no rótulo acessível. Toda aba precisa de ícone nessa variante.
   */
  variante?: 'linha' | 'quadrados'
  className?: string
}

/**
 * Abas de uma tela (SESSAO-25): visões diferentes do MESMO filho de rota —
 * não são rotas novas (D-36). Alvo de 44px, a aba ativa com borda de ação e
 * texto forte (nunca só cor — M-12), setas do teclado trocam de aba. No
 * celular as abas quebram linha em vez de rolar a página de lado.
 *
 * O painel é da tela: use `role="tabpanel"`, `id={`${idBase}-painel`}` e
 * `aria-labelledby={`${idBase}-aba-${valor}`}`.
 */
export function Abas<T extends string>({
  rotulo,
  abas,
  valor,
  aoMudar,
  idBase,
  variante = 'linha',
  className,
}: AbasProps<T>) {
  const refs = useRef<Map<T, HTMLButtonElement>>(new Map())
  const quadrados = variante === 'quadrados'

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const passo = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0
    if (passo === 0) return
    evento.preventDefault()
    const proxima = abas[(indice + passo + abas.length) % abas.length]
    aoMudar(proxima.valor)
    refs.current.get(proxima.valor)?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={rotulo}
      className={cn(
        quadrados ? 'flex gap-2' : 'flex flex-wrap gap-x-1 gap-y-1 border-b border-borda',
        className,
      )}
    >
      {abas.map((aba, indice) => {
        const ativa = aba.valor === valor
        return (
          <button
            key={aba.valor}
            ref={(el) => {
              if (el) refs.current.set(aba.valor, el)
              else refs.current.delete(aba.valor)
            }}
            type="button"
            role="tab"
            id={`${idBase}-aba-${aba.valor}`}
            aria-selected={ativa}
            aria-controls={`${idBase}-painel`}
            aria-label={quadrados ? aba.rotulo : undefined}
            tabIndex={ativa ? 0 : -1}
            onClick={() => aoMudar(aba.valor)}
            onKeyDown={(e) => aoTeclar(e, indice)}
            className={cn(
              quadrados
                ? cn(
                    'group relative inline-flex size-toque-md items-center justify-center rounded-dm border',
                    'transition-[background-color,border-color,box-shadow,translate] duration-150',
                    '[&>svg]:size-5 [&>svg]:shrink-0',
                    // A microinteração da casa: sobe 2px com sombra suave (D-27).
                    'hover:-translate-y-0.5 hover:shadow-md hover:shadow-grafite-950/20',
                    'focus-visible:-translate-y-0.5 focus-visible:shadow-md focus-visible:shadow-grafite-950/20',
                    'active:translate-y-0 active:shadow-none',
                    ativa
                      ? 'border-acao-ativa bg-acao text-acao-texto'
                      : 'border-borda-forte bg-superficie text-texto-suave hover:bg-superficie-sutil hover:text-texto',
                  )
                : cn(
                    '-mb-px inline-flex min-h-toque-md items-center gap-2 rounded-t-dm border-b-2 px-4 text-sm transition-colors',
                    '[&_svg]:size-4 [&_svg]:shrink-0',
                    ativa
                      ? 'border-acao-ativa font-semibold text-texto'
                      : 'border-transparent text-texto-suave hover:bg-superficie-sutil hover:text-texto',
                  ),
            )}
          >
            {aba.icone}
            {quadrados ? (
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute top-full right-0 z-20 mt-2 whitespace-nowrap rounded-dm',
                  'bg-superficie-inversa px-2.5 py-1 text-xs font-medium text-texto-inverso shadow-md',
                  'opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100',
                )}
              >
                {aba.rotulo}
              </span>
            ) : (
              aba.rotulo
            )}
          </button>
        )
      })}
    </div>
  )
}
