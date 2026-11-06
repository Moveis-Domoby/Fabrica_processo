import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CircleHelp } from 'lucide-react'
import { Dica } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { BotaoVoltar } from './BotaoVoltar'
import { VagaDoTitulo } from './vagaDoTitulo'

/**
 * Na barra escura, o texto de apoio (cor "suave"/"fraca" — o total ao lado do
 * título, a data, o cadeado) vira o cinza claro da barra; senão some (cinza sobre
 * cinza — o "(5.724)" de Todos os pedidos, 06/11). Só no título e no selo: o
 * balão do ? continua com as cores da página.
 */
const APOIO_NA_BARRA =
  '[--dm-texto-suave:var(--dm-grafite-300)] [--dm-texto-fraco:var(--dm-grafite-300)]'

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
 * ↩️ 3ª/4ª volta (06/11): a setinha, o nome e o **?** moram na barra escura
 * do topo (a `VagaDoTitulo` da casca) — em TODA tela, celular e computador; na
 * página fica só a linha das ações (e nada, se a tela não tiver ação).
 *
 * O `header` é `relative` (e a barra do topo é `sticky`): o balão do **?**
 * ancora nele (ver `Dica`) e nunca estoura a borda da tela no celular.
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
  const vaga = useContext(VagaDoTitulo)
  // ↩️ 4ª volta (06/11): a barra escura existe em toda tela — o título vai
  // sempre para ela quando a casca oferece a vaga.
  const naBarra = vaga !== null

  const grupoDoTitulo = (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1.5',
        naBarra ? 'flex-1 text-grafite-50' : 'min-h-toque-md',
      )}
    >
      {!semVoltar && (
        <BotaoVoltar
          className={
            naBarra ? 'ml-0 text-grafite-100 hover:bg-grafite-600 hover:text-grafite-50' : undefined
          }
        />
      )}
      {icone && (
        <span
          aria-hidden
          className={cn(
            'inline-flex shrink-0 [&>svg]:size-5 [&>svg]:shrink-0',
            naBarra ? 'text-grafite-200' : 'text-texto-suave',
          )}
        >
          {icone}
        </span>
      )}
      <h1
        className={cn(
          'min-w-0 text-lg leading-tight sm:text-xl',
          naBarra && cn('truncate text-base sm:text-lg', APOIO_NA_BARRA),
        )}
      >
        {titulo}
      </h1>
      {selo && naBarra ? <span className={cn('contents', APOIO_NA_BARRA)}>{selo}</span> : selo}
      {ajuda && (
        <Dica
          rotulo={rotuloAjuda}
          compacta
          tom={naBarra ? 'menu' : 'padrao'}
          icone={<CircleHelp aria-hidden className="size-[1.125rem]" />}
        >
          {ajuda}
        </Dica>
      )}
    </div>
  )

  const acoes = children ? (
    <div
      className={cn('flex min-w-0 flex-auto flex-wrap items-center justify-end gap-2', classeAcoes)}
    >
      {children}
    </div>
  ) : null

  if (naBarra) {
    return (
      <>
        {createPortal(grupoDoTitulo, vaga)}
        {acoes && (
          // ↩️ Ajuste do dono (06/11 — Expedição/Entregas, virou padrão): um traço
          // bem leve separa a linha das ações (busca, abas, botões) dos dados.
          <header
            className={cn(
              'relative flex flex-wrap items-center gap-2 border-b border-borda/50 pb-3',
              className,
            )}
          >
            {acoes}
          </header>
        )}
      </>
    )
  }

  return (
    <header className={cn('relative flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
      {grupoDoTitulo}
      {acoes}
    </header>
  )
}
