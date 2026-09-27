import {
  Ban,
  CircleCheckBig,
  Clock,
  ClipboardCheck,
  Flag,
  GripVertical,
  History,
  Hourglass,
  Images,
  Pause,
  Play,
  UserRound,
} from 'lucide-react'
import { BadgeEstado, Botao } from '@/componentes/ui'
import { cn } from '@/lib/cn'
import { formatarDuracao, formatarDuracaoMs } from '../tempo'
import { pedidoCancelado } from '../situacao'
import type { Card, ParecerPendente, PedidoResumo } from '../tipos'
import { rotuloOrigemCard } from '../rotulos'

export interface CartaoUnidadeProps {
  card: Card
  pedido?: PedidoResumo
  agora: number
  /**
   * SESSAO-24: "Concluir produção" — o ÚNICO botão de gesto que sobrou nos
   * quadros, e só na LIMPEZA E EMBALAGEM (dono, 27/09). O resto é arrastar.
   */
  aoConcluir?: (card: Card) => void
  /** Abre a linha do tempo do card (SESSAO-05). */
  aoLinhaTempo?: (card: Card) => void
  /** Tablet (D-28): o espaço de imagens da peça. */
  aoFotos?: (card: Card) => void
  /** Desde quando a execução aberta corre (vem de plt_vw_execucoes). */
  execucaoDesde?: string
  /** Nome de quem está executando agora. */
  executorNome?: string
  /** true quando quem olha a tela é o executor atual. */
  souExecutor?: boolean
  /** true no card há mais tempo esperando sem ninguém na etapa (indicador da demanda). */
  esperandoHaMaisTempo?: boolean
  /** Desabilita o botão enquanto um gesto roda. */
  gestoPendente?: boolean
  /** true quando o card está num setor terminal (D-13): mostra a chegada. */
  terminal?: boolean
  /** Marcação de quem entregou ainda sem parecer (SESSAO-06/D-09): ao arrastar
   *  para o trabalho, a confirmação de recebimento vem antes. */
  parecerPendente?: ParecerPendente
  arrastando?: boolean
  /** 'galpao' = a tela do setor no tablet: letra maior, sem dado de cliente (D-28). */
  tamanho?: 'padrao' | 'galpao'
}

/**
 * O card de UNIDADE (D-01): o (k/n) que percorre os setores.
 * O tempo mora nele desde a SESSAO-05 (D-02/D-24): na fila, o tempo do SETOR
 * (sem dono); em execução, QUEM executa e há quanto tempo.
 *
 * SESSAO-24 (dono, 27/09): os botões de gesto saíram — o card se ARRASTA.
 * Soltar na etapa de trabalho inicia o tempo; soltar numa etapa com nome de
 * setor (ou no CONCLUÍDO) leva o card adiante. Ficam só os ícones de ver
 * (histórico, fotos) e, na LIMPEZA E EMBALAGEM, o "Concluir produção".
 */
export function CartaoUnidade({
  card,
  pedido,
  agora,
  aoConcluir,
  aoLinhaTempo,
  aoFotos,
  execucaoDesde,
  executorNome,
  souExecutor = false,
  esperandoHaMaisTempo = false,
  gestoPendente = false,
  terminal = false,
  parecerPendente,
  arrastando = false,
  tamanho = 'padrao',
}: CartaoUnidadeProps) {
  const galpao = tamanho === 'galpao'
  const kn =
    card.indice_unidade !== null && card.total_unidades !== null
      ? `(${card.indice_unidade}/${card.total_unidades})`
      : ''
  const emExecucao = card.executor_atual_id !== null
  // SESSAO-22 (D-48): pausado não conta tempo nem ocupa o limite.
  const pausado = emExecucao && card.pausado_em !== null
  // SESSAO-24: a peça segue na produção com o pedido cancelado — ao concluir,
  // ela vai para o estoque sem dono. Lido da situação do pedido (a mesma fonte
  // do evento de cancelamento — nada guardado para dessincronizar).
  const cancelado = card.pedido_id !== null && pedidoCancelado(pedido?.situacao)
  // D-48: o tempo em PCP é do PEDIDO — da entrada até a liberação completa.
  const pcpMs = pedido?.entrou_pcp_em
    ? (pedido.liberado_completo_em
        ? new Date(pedido.liberado_completo_em).getTime()
        : agora) - new Date(pedido.entrou_pcp_em).getTime()
    : null
  const temRodape = aoLinhaTempo || aoFotos || (!terminal && aoConcluir)

  return (
    <article
      className={cn(
        'flex flex-col gap-2 rounded-dm border bg-superficie',
        galpao ? 'p-4' : 'p-3',
        emExecucao ? 'border-acao-ativa' : 'border-borda',
        arrastando && 'opacity-60 shadow-lg',
      )}
      aria-label={`Unidade ${kn} — ${rotuloOrigemCard(card, pedido)}`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            'font-semibold text-texto tabular-nums',
            galpao ? 'text-base' : 'text-sm',
          )}
        >
          {rotuloOrigemCard(card, pedido)}
        </span>
        <span className="flex items-center gap-1">
          {kn && (
            <span
              className={cn(
                'font-medium text-texto-suave tabular-nums',
                galpao ? 'text-base' : 'text-sm',
              )}
            >
              {kn}
            </span>
          )}
          {/* O card se arrasta (SESSAO-24) — a pega diz isso sem texto. */}
          <GripVertical aria-hidden className="size-4 shrink-0 text-texto-fraco" />
        </span>
      </header>

      <p className={cn('line-clamp-2 text-texto', galpao ? 'text-lg font-medium' : 'text-sm')}>
        {card.item_descricao ?? 'Sem descrição'}
      </p>
      {/* D-28: a tela do galpão não mostra dado de cliente. */}
      {!galpao && pedido?.cliente_nome && (
        <p className="line-clamp-1 text-xs text-texto-fraco">{pedido.cliente_nome}</p>
      )}
      {cancelado && (
        // M-12: estado com ícone + texto, nunca só cor.
        <p>
          <span className="inline-flex items-center gap-1 rounded-full bg-danificado-fundo px-2.5 py-0.5 text-xs font-medium text-danificado-texto">
            <Ban aria-hidden className="size-3.5" />
            Pedido cancelado — pronta, vai para o estoque
          </span>
        </p>
      )}
      {/* D-48: o tempo em PCP verdadeiro — do pedido, entrada → liberação completa. */}
      {!galpao && pcpMs !== null && (
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
          className={cn(
            'inline-flex flex-wrap items-center gap-1.5 text-texto tabular-nums',
            galpao ? 'text-base' : 'text-sm',
          )}
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
            'inline-flex items-center gap-1.5 tabular-nums',
            galpao ? 'text-base' : 'text-sm',
            esperandoHaMaisTempo ? 'font-medium text-atencao-texto' : 'text-texto-suave',
          )}
          title={
            card.desde
              ? `Esperando alguém pegar desde ${new Date(card.desde).toLocaleString('pt-BR')}`
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
          <span className="text-texto-suave">— você confirma ao pegar para trabalhar.</span>
        </p>
      )}

      {card.qualidade_atual && (
        <div>
          <BadgeEstado estado={card.qualidade_atual} tamanho="sm" />
        </div>
      )}

      {temRodape && (
        <footer className="mt-1 flex items-center gap-2">
          {aoLinhaTempo && (
            <Botao
              variante="fantasma"
              tamanho="sm"
              icone={<History />}
              className="min-h-toque-md shrink-0 px-2"
              aria-label="Linha do tempo do card"
              // Enter/Espaço no botão é do botão — não pode virar arrasto de teclado.
              onKeyDown={(e) => e.stopPropagation()}
              onClick={() => aoLinhaTempo(card)}
            />
          )}
          {aoFotos && (
            <Botao
              variante="fantasma"
              tamanho="sm"
              icone={<Images />}
              className="min-h-toque-md shrink-0 px-2"
              aria-label="Fotos da peça"
              onKeyDown={(e) => e.stopPropagation()}
              onClick={() => aoFotos(card)}
            />
          )}
          {!terminal && aoConcluir && (
            <Botao
              variante="secundaria"
              tamanho={galpao ? 'lg' : 'sm'}
              icone={<CircleCheckBig />}
              className="min-h-toque-md min-w-0 flex-1 px-2"
              disabled={gestoPendente}
              onKeyDown={(e) => e.stopPropagation()}
              onClick={() => aoConcluir(card)}
            >
              Concluir produção
            </Botao>
          )}
        </footer>
      )}
    </article>
  )
}
