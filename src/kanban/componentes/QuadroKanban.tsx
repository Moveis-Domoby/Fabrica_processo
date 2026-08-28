import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/cn'
import { CartaoUnidade } from './CartaoUnidade'
import type { Card, Etapa, ExecucaoAberta, PedidoResumo, Setor } from '../tipos'

/** Id de coluna no drag-and-drop: etapa real ou a "Chegada" (etapa nula). */
const CHEGADA = 'chegada'

/** O que os cards precisam saber além de si mesmos (SESSAO-05). */
export interface ContextoExecucao {
  /** Execução aberta por card (de plt_vw_execucoes). */
  execucoesPorCard: Map<number, ExecucaoAberta>
  /** id → nome, para dizer QUEM executa. */
  nomesUsuarios: Map<string, string>
  /** Quem está olhando a tela (para "você" e para o Assumir). */
  meuUsuarioId: string
  gestoPendente: boolean
  aoIniciar?: (card: Card) => void
  aoFinalizar?: (card: Card) => void
  aoLinhaTempo?: (card: Card) => void
}

interface ColunaProps {
  id: string
  titulo: string
  ehFila?: boolean
  cards: Card[]
  pedidosPorId: Map<number, PedidoResumo>
  agora: number
  terminal: boolean
  aoMover: (card: Card) => void
  arrastavel: boolean
  execucao: ContextoExecucao
}

function Coluna({
  id,
  titulo,
  ehFila = false,
  cards,
  pedidosPorId,
  agora,
  terminal,
  aoMover,
  arrastavel,
  execucao,
}: ColunaProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  // Indicador de espera da demanda: com 2+ cards sem ninguém, o que espera há
  // mais tempo ganha destaque (a ordenação por chegada já o põe no topo).
  const esperando = cards.filter((c) => c.executor_atual_id === null)
  const maisAntigoEsperandoId =
    !terminal && esperando.length >= 2
      ? esperando.reduce((a, b) => ((a.desde ?? '') <= (b.desde ?? '') ? a : b)).id
      : null

  return (
    <section
      ref={setNodeRef}
      aria-label={`Etapa ${titulo} com ${cards.length} card(s)`}
      className={cn(
        'flex w-[85vw] max-w-xs shrink-0 snap-start flex-col rounded-dm-lg border bg-superficie-sutil sm:w-72',
        isOver ? 'border-acao-ativa ring-2 ring-acao' : 'border-borda',
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-borda px-3 py-2.5">
        <h3 className="text-sm font-semibold text-texto">{titulo}</h3>
        <span className="flex items-center gap-2">
          {ehFila && (
            <span className="rounded-full bg-info-fundo px-2 py-0.5 text-xs font-medium text-info-texto">
              fila
            </span>
          )}
          <span className="rounded-full bg-superficie px-2 py-0.5 text-xs font-medium text-texto-suave tabular-nums">
            {cards.length}
          </span>
        </span>
      </header>

      <div className="flex min-h-28 flex-1 flex-col gap-2 p-2">
        {cards.length === 0 && (
          <p className="flex flex-1 items-center justify-center py-6 text-sm text-texto-fraco">
            Vazio
          </p>
        )}
        {cards.map((card) => {
          const execucaoAberta = execucao.execucoesPorCard.get(card.id)
          const comuns = {
            card,
            pedido: pedidosPorId.get(card.pedido_id),
            agora,
            terminal,
            aoMover,
            aoIniciar: execucao.aoIniciar,
            aoFinalizar: execucao.aoFinalizar,
            aoLinhaTempo: execucao.aoLinhaTempo,
            execucaoDesde: execucaoAberta?.iniciou_em,
            executorNome: card.executor_atual_id
              ? execucao.nomesUsuarios.get(card.executor_atual_id)
              : undefined,
            souExecutor: card.executor_atual_id === execucao.meuUsuarioId,
            esperandoHaMaisTempo: card.id === maisAntigoEsperandoId,
            gestoPendente: execucao.gestoPendente,
          }
          return arrastavel ? (
            <CardArrastavel key={card.id} {...comuns} />
          ) : (
            <CartaoUnidade key={card.id} {...comuns} />
          )
        })}
      </div>
    </section>
  )
}

type CardArrastavelProps = Parameters<typeof CartaoUnidade>[0]

function CardArrastavel(props: CardArrastavelProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: props.card.id,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn('touch-manipulation', isDragging && 'z-10 cursor-grabbing')}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
    >
      <CartaoUnidade {...props} arrastando={isDragging} />
    </div>
  )
}

export interface QuadroKanbanProps {
  setor: Setor
  etapas: Etapa[]
  cards: Card[]
  pedidosPorId: Map<number, PedidoResumo>
  agora: number
  /** Drag-and-drop entre etapas do MESMO setor (desktop). */
  aoMoverParaEtapa: (card: Card, etapaId: number | null) => void
  /** Abre o modal "Mover para…" (o gesto do tablet). */
  aoAbrirMover: (card: Card) => void
  /** Os gestos e dados de execução da SESSAO-05. */
  execucao: ContextoExecucao
}

/**
 * O quadro de um setor (RF-01/RF-07): etapas internas como colunas + a coluna
 * fixa "Chegada" (cards recém-chegados, antes de qualquer etapa — D-14 diz que
 * as etapas nascem vazias, então todo setor tem pelo menos esta coluna).
 * Dois gestos de movimentação, como manda a demanda: arrastar (desktop) e o
 * botão "Mover" de cada card (tablet). Desde a SESSAO-05, os cards carregam
 * também Iniciar/Finalizar/Assumir — o clique que vira medição (D-02).
 */
export function QuadroKanban({
  setor,
  etapas,
  cards,
  pedidosPorId,
  agora,
  aoMoverParaEtapa,
  aoAbrirMover,
  execucao,
}: QuadroKanbanProps) {
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const terminal = setor.papel_no_fluxo === 'terminal'

  function aoSoltar(evento: DragEndEvent) {
    const card = cards.find((c) => c.id === evento.active.id)
    if (!card || evento.over === null) return
    const etapaId = evento.over.id === CHEGADA ? null : Number(evento.over.id)
    if (etapaId === card.etapa_atual_id) return
    aoMoverParaEtapa(card, etapaId)
  }

  const cardsDaEtapa = (etapaId: number | null) =>
    cards.filter((c) => c.etapa_atual_id === etapaId)

  return (
    <DndContext sensors={sensores} onDragEnd={aoSoltar}>
      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 sm:snap-none"
        aria-label={`Quadro do setor ${setor.nome}`}
      >
        <Coluna
          id={CHEGADA}
          titulo="Chegada"
          cards={cardsDaEtapa(null)}
          pedidosPorId={pedidosPorId}
          agora={agora}
          terminal={terminal}
          aoMover={aoAbrirMover}
          arrastavel={etapas.length > 0}
          execucao={execucao}
        />
        {etapas.map((etapa) => (
          <Coluna
            key={etapa.id}
            id={String(etapa.id)}
            titulo={etapa.nome}
            ehFila={etapa.eh_fila}
            cards={cardsDaEtapa(etapa.id)}
            pedidosPorId={pedidosPorId}
            agora={agora}
            terminal={terminal}
            aoMover={aoAbrirMover}
            arrastavel
            execucao={execucao}
          />
        ))}
      </div>

      {etapas.length === 0 && (
        <p className="flex items-center gap-2 rounded-dm border border-borda bg-superficie p-4 text-sm text-texto-suave">
          <Inbox aria-hidden className="size-5 shrink-0" />
          Este setor ainda não tem etapas internas cadastradas — os cards ficam na Chegada. Um
          líder do setor ou admin cadastra as etapas em Estrutura (cada etapa nova já nasce
          contando tempo).
        </p>
      )}
    </DndContext>
  )
}
