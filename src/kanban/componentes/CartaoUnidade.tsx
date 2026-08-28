import { Clock, Flag, History, Hourglass, MoveRight, Play, Square, UserRound } from 'lucide-react'
import { BadgeEstado, Botao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { formatarDuracao } from '../tempo'
import type { Card, PedidoResumo } from '../tipos'

export interface CartaoUnidadeProps {
  card: Card
  pedido?: PedidoResumo
  agora: number
  /** Abre o modal "Mover para…" — o gesto de tablet (D-06). */
  aoMover?: (card: Card) => void
  /** Iniciar / assumir a execução (SESSAO-05, D-24). */
  aoIniciar?: (card: Card) => void
  /** Finalizar a execução (SESSAO-05). */
  aoFinalizar?: (card: Card) => void
  /** Abre a linha do tempo do card (SESSAO-05). */
  aoLinhaTempo?: (card: Card) => void
  /** Desde quando a execução aberta corre (vem de plt_vw_execucoes). */
  execucaoDesde?: string
  /** Nome de quem está executando agora. */
  executorNome?: string
  /** true quando quem olha a tela é o executor atual. */
  souExecutor?: boolean
  /** true no card há mais tempo esperando sem ninguém na etapa (indicador da demanda). */
  esperandoHaMaisTempo?: boolean
  /** Desabilita os gestos enquanto um deles roda. */
  gestoPendente?: boolean
  /** true quando o card está num setor terminal (D-13): mostra a chegada. */
  terminal?: boolean
  arrastando?: boolean
}

/**
 * O card de UNIDADE (D-01): o (k/n) que percorre os setores.
 * A SESSAO-05 pôs o tempo nele de verdade (D-02/D-24): na fila mostra o tempo
 * do SETOR (sem dono); em execução mostra QUEM está executando e há quanto
 * tempo — e os gestos Iniciar / Finalizar / Assumir, com dedo de galpão.
 */
export function CartaoUnidade({
  card,
  pedido,
  agora,
  aoMover,
  aoIniciar,
  aoFinalizar,
  aoLinhaTempo,
  execucaoDesde,
  executorNome,
  souExecutor = false,
  esperandoHaMaisTempo = false,
  gestoPendente = false,
  terminal = false,
  arrastando = false,
}: CartaoUnidadeProps) {
  const kn =
    card.indice_unidade !== null && card.total_unidades !== null
      ? `(${card.indice_unidade}/${card.total_unidades})`
      : ''
  const emExecucao = card.executor_atual_id !== null
  const comGestos = !terminal && (aoIniciar !== undefined || aoFinalizar !== undefined)

  return (
    <article
      className={cn(
        'flex flex-col gap-2 rounded-dm border bg-superficie p-3',
        emExecucao ? 'border-acao-ativa' : 'border-borda',
        arrastando && 'opacity-60 shadow-lg',
      )}
      aria-label={`Unidade ${kn} do pedido ${pedido?.numero ?? card.pedido_id}`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-texto tabular-nums">
          Pedido {pedido?.numero ?? '…'}
        </span>
        {kn && <span className="text-sm font-medium text-texto-suave tabular-nums">{kn}</span>}
      </header>

      <p className="line-clamp-2 text-sm text-texto">{card.item_descricao ?? 'Sem descrição'}</p>
      {pedido?.cliente_nome && (
        <p className="line-clamp-1 text-xs text-texto-fraco">{pedido.cliente_nome}</p>
      )}

      {/* O tempo, como a D-02 manda: fila é do setor, execução é da pessoa. */}
      {terminal ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-texto-suave tabular-nums">
          <Flag aria-hidden className="size-4 text-perfeito-forte" />
          {formatarDuracao(card.desde, agora)}
          <span className="sr-only">desde a chegada ao fim de linha</span>
        </p>
      ) : emExecucao ? (
        <p
          className="inline-flex flex-wrap items-center gap-1.5 text-sm text-texto tabular-nums"
          title={
            execucaoDesde
              ? `Em execução desde ${new Date(execucaoDesde).toLocaleString('pt-BR')}`
              : undefined
          }
        >
          <Play aria-hidden className="size-4 text-perfeito-forte" />
          <span className="font-medium">
            {formatarDuracao(execucaoDesde ?? card.desde, agora)}
          </span>
          <span className="inline-flex items-center gap-1 text-texto-suave">
            <UserRound aria-hidden className="size-4" />
            {souExecutor ? 'você' : (executorNome ?? '…')}
          </span>
        </p>
      ) : (
        <p
          className={cn(
            'inline-flex items-center gap-1.5 text-sm tabular-nums',
            esperandoHaMaisTempo ? 'font-medium text-atencao-texto' : 'text-texto-suave',
          )}
          title={
            card.desde
              ? `Esperando alguém iniciar desde ${new Date(card.desde).toLocaleString('pt-BR')}`
              : undefined
          }
        >
          {esperandoHaMaisTempo ? (
            <Hourglass aria-hidden className="size-4" />
          ) : (
            <Clock aria-hidden className="size-4" />
          )}
          {formatarDuracao(card.desde, agora)} na fila
          {esperandoHaMaisTempo && <span> · há mais tempo esperando</span>}
        </p>
      )}

      <footer className="mt-1 flex flex-wrap items-center gap-2">
        {comGestos &&
          (emExecucao ? (
            <>
              {aoFinalizar && (
                <Botao
                  tamanho="sm"
                  icone={<Square />}
                  className="min-h-toque-md flex-1"
                  disabled={gestoPendente}
                  onClick={() => aoFinalizar(card)}
                >
                  Finalizar
                </Botao>
              )}
              {!souExecutor && aoIniciar && (
                <Botao
                  variante="secundaria"
                  tamanho="sm"
                  icone={<Play />}
                  className="min-h-toque-md"
                  disabled={gestoPendente}
                  onClick={() => aoIniciar(card)}
                >
                  Assumir
                </Botao>
              )}
            </>
          ) : (
            aoIniciar && (
              <Botao
                tamanho="sm"
                icone={<Play />}
                className="min-h-toque-md flex-1"
                disabled={gestoPendente}
                onClick={() => aoIniciar(card)}
              >
                Iniciar
              </Botao>
            )
          ))}

        <span className="ml-auto flex items-center gap-2">
          {card.qualidade_atual && <BadgeEstado estado={card.qualidade_atual} tamanho="sm" />}
          {aoLinhaTempo && (
            <Botao
              variante="fantasma"
              tamanho="sm"
              icone={<History />}
              className="min-h-toque-md"
              aria-label="Linha do tempo do card"
              onClick={() => aoLinhaTempo(card)}
            />
          )}
          {aoMover && (
            <Botao
              variante="secundaria"
              tamanho="sm"
              icone={<MoveRight />}
              className="min-h-toque-md"
              onClick={() => aoMover(card)}
            >
              Mover
            </Botao>
          )}
        </span>
      </footer>
    </article>
  )
}
