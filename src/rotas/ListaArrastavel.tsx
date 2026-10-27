import type { ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { GripVertical, Lock } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * A ordem da rota se ARRASTA (ajustes da SESSAO-28, 03/10 — D-111, ↩️ os
 * botões de subir/descer da D-109): "podendo arrastar ele pra cima ou pra baixo
 * pra recalcular a ordenação". Alça de 44 px em cada linha; os mesmos sensores
 * do quadro do kanban — mouse com 8 px de folga, toque com 200 ms de espera (no
 * tablet a página continua rolando com o dedo) e teclado (espaço pega, setas
 * movem, espaço solta) para quem não usa o mouse.
 *
 * SESSAO-41 (D-196): `arrastavel` trava linha a linha — a travada fica sem
 * alça (um cadeado no lugar), mas continua sendo LUGAR de soltar: a parada do
 * entregador cai entre dois pedidos travados. Mover uma linha só nunca muda a
 * ordem relativa das outras.
 */
export function ListaArrastavel({
  ids,
  rotulo,
  aoReordenar,
  desligada = false,
  arrastavel,
  children,
}: {
  ids: number[]
  /** Nome da lista para o leitor de tela. */
  rotulo: string
  aoReordenar: (novos: number[]) => void
  desligada?: boolean
  /** Quem pode ser arrastado (padrão: todos). */
  arrastavel?: (id: number) => boolean
  children: (id: number, indice: number) => ReactNode
}) {
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function aoSoltar(evento: DragEndEvent) {
    const { active, over } = evento
    if (!over || active.id === over.id) return
    const de = ids.indexOf(Number(active.id))
    const para = ids.indexOf(Number(over.id))
    if (de < 0 || para < 0) return
    aoReordenar(arrayMove(ids, de, para))
  }

  return (
    <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={desligada}>
        <ol className="flex flex-col gap-2" aria-label={rotulo}>
          {ids.map((id, indice) => (
            <LinhaArrastavel
              key={id}
              id={id}
              desligada={desligada}
              travada={arrastavel ? !arrastavel(id) : false}
            >
              {children(id, indice)}
            </LinhaArrastavel>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

function LinhaArrastavel({
  id,
  desligada,
  travada,
  children,
}: {
  id: number
  desligada: boolean
  travada: boolean
  children: ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    // travada: não pega, mas recebe (dá para soltar a outra antes ou depois dela)
    disabled: desligada ? true : travada ? { draggable: true, droppable: false } : false,
  })
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
          : undefined,
        transition,
      }}
      className={cn('relative flex items-stretch gap-1', isDragging && 'z-10 opacity-90 shadow-lg')}
    >
      {!desligada &&
        (travada ? (
          <span
            className="flex w-11 shrink-0 items-center justify-center text-texto-fraco"
            title="Esta não muda de lugar aqui"
          >
            <Lock aria-hidden className="size-4" />
          </span>
        ) : (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label="Arrastar para mudar a ordem"
            className="flex w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-dm text-texto-suave hover:bg-superficie-sutil active:cursor-grabbing"
          >
            <GripVertical aria-hidden className="size-5" />
          </button>
        ))}
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  )
}
