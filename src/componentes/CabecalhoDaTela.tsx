import type { ReactNode } from 'react'
import { CircleHelp } from 'lucide-react'
import { Dica } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { BotaoVoltar } from './BotaoVoltar'

export interface CabecalhoDaTelaProps {
  /** O nome da tela (o `h1`). */
  titulo: ReactNode
  /** Ícone opcional antes do título (desenhado em 20 px). */
  icone?: ReactNode
  /** Pílula opcional logo depois do título (ex.: "fim de linha"). */
  selo?: ReactNode
  /**
   * O texto que explica a tela — vai para o **?** ao lado do título (abre ao
   * passar o mouse, ao focar ou ao tocar). Nunca embaixo do título.
   */
  ajuda?: ReactNode
  /** O nome do **?** para o leitor de tela. */
  rotuloAjuda?: string
  /**
   * As ações e controles da tela, NA MESMA LINHA do título (descem para a
   * linha de baixo só quando não cabem). Ficam à direita; um item com
   * `mr-auto` puxa os anteriores para junto do título.
   */
  children?: ReactNode
  /** Classes extras do bloco das ações. */
  classeAcoes?: string
  /** Tela sem a setinha de voltar (fora da casca — o tablet, a TV). */
  semVoltar?: boolean
  className?: string
}

/**
 * O topo de TODA tela da casca — ajuste do dono de 06/11 ("diminuir o tamanho
 * desses headers… de TODAS AS TELAS, SEM EXCEÇÃO"): a setinha de voltar, o
 * título um terço menor (era `text-2xl sm:text-3xl`), o **?** com a
 * explicação no lugar do parágrafo de baixo, e as ações na mesma linha.
 *
 * O `header` é `relative`: o balão do **?** ancora nele (ver `Dica`) e nunca
 * estoura a borda da tela no celular.
 */
export function CabecalhoDaTela({
  titulo,
  icone,
  selo,
  ajuda,
  rotuloAjuda = 'Sobre esta tela',
  children,
  classeAcoes,
  semVoltar = false,
  className,
}: CabecalhoDaTelaProps) {
  return (
    <header className={cn('relative flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
      <div className="flex min-h-toque-md min-w-0 items-center gap-1.5">
        {!semVoltar && <BotaoVoltar />}
        {icone && (
          <span
            aria-hidden
            className="inline-flex shrink-0 text-texto-suave [&>svg]:size-5 [&>svg]:shrink-0"
          >
            {icone}
          </span>
        )}
        <h1 className="min-w-0 text-lg leading-tight sm:text-xl">{titulo}</h1>
        {selo}
        {ajuda && (
          <Dica
            rotulo={rotuloAjuda}
            compacta
            icone={<CircleHelp aria-hidden className="size-[1.125rem]" />}
          >
            {ajuda}
          </Dica>
        )}
      </div>
      {children && (
        <div
          className={cn(
            'flex min-w-0 flex-auto flex-wrap items-center justify-end gap-2',
            classeAcoes,
          )}
        >
          {children}
        </div>
      )}
    </header>
  )
}
