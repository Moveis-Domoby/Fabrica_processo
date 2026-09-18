import { cn } from '@/lib/cn'
import { Selecao } from '@/componentes/ui'
import type { OpcaoSelecao } from '@/componentes/ui/Selecao'

/**
 * Filtros em pill numa linha acima dos gráficos (regra 6 do LEIA-ME).
 * Grupo de botões-rádio, mesmo padrão dos chips da S10: borda de ação quando
 * ligado, alvo mínimo de 44px (D-06).
 */
export function FiltroPill<T extends string>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
}: {
  rotulo: string
  opcoes: readonly { valor: T; rotulo: string }[]
  valor: T
  aoMudar: (v: T) => void
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">{rotulo}</legend>
      <span aria-hidden className="mr-0.5 text-sm font-medium text-texto-suave">
        {rotulo}:
      </span>
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => aoMudar(o.valor)}
          className={cn(
            'min-h-toque-md rounded-full border px-3 text-sm font-medium transition-colors',
            valor === o.valor
              ? 'border-acao-ativa bg-acao text-acao-texto'
              : 'border-borda-forte bg-superficie text-texto-suave hover:text-texto',
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </fieldset>
  )
}

/** O filtro de setor continua um dropdown (a lista cresce com o cadastro). */
export function FiltroSetor({
  opcoes,
  valor,
  aoMudar,
}: {
  opcoes: OpcaoSelecao[]
  valor: string
  aoMudar: (v: string) => void
}) {
  return (
    <div className="w-full max-w-56 [&_label]:sr-only">
      <Selecao
        rotulo="Setor"
        opcoes={[{ valor: 'todos', rotulo: 'Setores: todos' }, ...opcoes]}
        valor={valor}
        aoMudar={aoMudar}
      />
    </div>
  )
}
