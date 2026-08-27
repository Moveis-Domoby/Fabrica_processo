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
import type { Card, Etapa, PedidoResumo, Setor } from '../tipos'

/** Id de coluna no drag-and-drop: etapa real ou a "Chegada" (etapa nula). */
const CHEGADA = 'chegada'

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
}: ColunaProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

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
        {cards.map((card) =>
          arrastavel ? (
            <CardArrastavel
              key={card.id}
              card={card}
              pedido={pedidosPorId.get(card.pedido_id)}
              agora={agora}
              terminal={terminal}
              aoMover={aoMover}
            />
          ) : (
            <CartaoUnidade
              key={card.id}
              card={card}
              pedido={pedidosPorId.get(card.pedido_id)}
              agora={agora}
              terminal={terminal}
              aoMover={aoMover}
            />
          ),
        )}
      </div>
    </section>
  )
}

function CardArrastavel(props: {
  card: Card
  pedido?: PedidoResumo
  agora: number
  terminal: boolean
  aoMover: (card: Card) => void
}) {
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
      <CartaoUnidade
        card={props.card}
        pedido={props.pedido}
        agora={props.agora}
        terminal={props.terminal}
        aoMover={props.aoMover}
        arrastando={isDragging}
      />
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
}

/**
 * O quadro de um setor (RF-01/RF-07): etapas internas como colunas + a coluna
 * fixa "Chegada" (cards recém-chegados, antes de qualquer etapa — D-14 diz que
 * as etapas nascem vazias, então todo setor tem pelo menos esta coluna).
 * Dois gestos de movimentação, como manda a demanda: arrastar (desktop) e o
 * botão "Mover" de cada card (tablet).
 */
export function QuadroKanban({
  setor,
  etapas,
  cards,
  pedidosPorId,
  agora,
  aoMoverParaEtapa,
  aoAbrirMover,
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
