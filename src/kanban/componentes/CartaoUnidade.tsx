import {
  CircleCheckBig,
  Clock,
  ClipboardCheck,
  Flag,
  History,
  Hourglass,
  MoveRight,
  Pause,
  Play,
  Square,
  UserRound,
} from 'lucide-react'
import { BadgeEstado, Botao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { formatarDuracao, formatarDuracaoMs } from '../tempo'
import type { Card, ParecerPendente, PedidoResumo } from '../tipos'

export interface CartaoUnidadeProps {
  card: Card
  pedido?: PedidoResumo
  agora: number
  /** Abre o modal "Mover para…" — o gesto de tablet (D-06). */
  aoMover?: (card: Card) => void
  /** SESSAO-15: "Concluir" — a peça está pronta e vai para o fim de linha (ESTOQUE). */
  aoConcluir?: (card: Card) => void
  /** Iniciar / assumir a execução (SESSAO-05, D-24). */
  aoIniciar?: (card: Card) => void
  /** Finalizar a execução (SESSAO-05). */
  aoFinalizar?: (card: Card) => void
  /** SESSAO-22 (D-48): pausar a execução — gesto de líder do setor ou admin. */
  aoPausar?: (card: Card) => void
  /** SESSAO-22 (D-48): retomar — quem executa (ao finalizar a urgência), líder ou admin. */
  aoRetomar?: (card: Card) => void
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
  /** Marcação de quem entregou ainda sem parecer (SESSAO-06/D-09): o Iniciar
   *  passa primeiro pela confirmação de recebimento. */
  parecerPendente?: ParecerPendente
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
  aoConcluir,
  aoIniciar,
  aoFinalizar,
  aoPausar,
  aoRetomar,
  aoLinhaTempo,
  execucaoDesde,
  executorNome,
  souExecutor = false,
  esperandoHaMaisTempo = false,
  gestoPendente = false,
  terminal = false,
  parecerPendente,
  arrastando = false,
}: CartaoUnidadeProps) {
  const kn =
    card.indice_unidade !== null && card.total_unidades !== null
      ? `(${card.indice_unidade}/${card.total_unidades})`
      : ''
  const emExecucao = card.executor_atual_id !== null
  // SESSAO-22 (D-48): pausado não conta tempo nem ocupa o limite.
  const pausado = emExecucao && card.pausado_em !== null
  const comGestos = !terminal && (aoIniciar !== undefined || aoFinalizar !== undefined)
  // D-48: o tempo em PCP é do PEDIDO — da entrada até a liberação completa.
  const pcpMs = pedido?.entrou_pcp_em
    ? (pedido.liberado_completo_em
        ? new Date(pedido.liberado_completo_em).getTime()
        : agora) - new Date(pedido.entrou_pcp_em).getTime()
    : null

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
      {/* D-48: o tempo em PCP verdadeiro — do pedido, entrada → liberação completa. */}
      {pcpMs !== null && (
        <p
          className="text-xs text-texto-fraco tabular-nums"
          title={
            pedido?.liberado_completo_em
              ? 'Tempo que o pedido esperou no PCP, da entrada até a liberação da última unidade.'
              : 'O pedido ainda tem unidade por liberar — o tempo em PCP segue contando.'
          }
        >
          Pedido ficou {formatarDuracaoMs(pcpMs)} em PCP
          {!pedido?.liberado_completo_em && ' (ainda contando)'}
        </p>
      )}

      {/* O tempo, como a D-02 manda: fila é do setor, execução é da pessoa. */}
      {terminal ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-texto-suave tabular-nums">
          <Flag aria-hidden className="size-4 text-perfeito-forte" />
          {formatarDuracao(card.desde, agora)}
          <span className="sr-only">desde a chegada ao fim de linha</span>
        </p>
      ) : pausado ? (
        // SESSAO-22 (D-48): pausado é estado com ícone + texto, nunca só cor (M-12).
        <p
          className="inline-flex flex-wrap items-center gap-1.5 text-sm font-medium text-atencao-texto tabular-nums"
          title={
            card.pausado_em
              ? `Pausado pelo líder em ${new Date(card.pausado_em).toLocaleString('pt-BR')} — o tempo não conta enquanto pausado.`
              : undefined
          }
        >
          <Pause aria-hidden className="size-4" />
          Pausado há {formatarDuracaoMs(agora - new Date(card.pausado_em ?? 0).getTime())}
          <span className="inline-flex items-center gap-1 font-normal text-texto-suave">
            <UserRound aria-hidden className="size-4" />
            {souExecutor ? 'você' : (executorNome ?? '…')}
          </span>
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

      {/* SESSAO-06 (D-09): a entrega marcada esperando a confirmação de quem recebe. */}
      {!terminal && parecerPendente && (
        <p className="flex flex-wrap items-center gap-1.5 rounded-dm bg-superficie-sutil px-2 py-1.5 text-xs text-texto">
          <ClipboardCheck aria-hidden className="size-4 shrink-0 text-texto-suave" />
          {parecerPendente.setorOrigemNome} entregou como
          <BadgeEstado estado={parecerPendente.estado} tamanho="sm" />
          <span className="text-texto-suave">— confirme ao iniciar.</span>
        </p>
      )}

      {/* Duas linhas de propósito (SESSAO-15): os gestos de tempo em cima; estado,
          histórico e destinos embaixo — nada estoura a borda do card. */}
      <footer className="mt-1 flex flex-col gap-2">
        {comGestos && (
          <div className="flex flex-wrap items-center gap-2">
            {pausado ? (
              // D-48: retomar volta a contar o tempo — quem executa (ao finalizar
              // a urgência), líder ou admin. O banco valida de verdade.
              aoRetomar && (
                <Botao
                  tamanho="sm"
                  icone={<Play />}
                  className="min-h-toque-md flex-1"
                  disabled={gestoPendente}
                  onClick={() => aoRetomar(card)}
                >
                  Retomar
                </Botao>
              )
            ) : emExecucao ? (
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
                {aoPausar && (
                  <Botao
                    variante="secundaria"
                    tamanho="sm"
                    icone={<Pause />}
                    className="min-h-toque-md"
                    disabled={gestoPendente}
                    onClick={() => aoPausar(card)}
                  >
                    Pausar
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
            )}
          </div>
        )}

        {card.qualidade_atual && (
          <div>
            <BadgeEstado estado={card.qualidade_atual} tamanho="sm" />
          </div>
        )}
        {(aoLinhaTempo || aoMover || (!terminal && aoConcluir)) && (
          <div className="flex items-center gap-2">
            {aoLinhaTempo && (
              <Botao
                variante="fantasma"
                tamanho="sm"
                icone={<History />}
                className="min-h-toque-md shrink-0 px-2"
                aria-label="Linha do tempo do card"
                onClick={() => aoLinhaTempo(card)}
              />
            )}
            {!terminal && aoConcluir && (
              <Botao
                variante="secundaria"
                tamanho="sm"
                icone={<CircleCheckBig />}
                className="min-h-toque-md min-w-0 flex-1 px-2"
                disabled={gestoPendente}
                onClick={() => aoConcluir(card)}
              >
                Concluir
              </Botao>
            )}
            {aoMover && (
              <Botao
                variante="secundaria"
                tamanho="sm"
                icone={<MoveRight />}
                className="min-h-toque-md min-w-0 flex-1 px-2"
                onClick={() => aoMover(card)}
              >
                Mover
              </Botao>
            )}
          </div>
        )}
      </footer>
    </article>
  )
}
